/**
 * Desktop shell for the Gita app: loads the desktop UI (webapp/, built into
 * electron/web/ by scripts/export-web.js) from an app:// origin and serves the
 * bundled SQLite database to it over IPC.
 *
 * Why the database lives here and not in the page: expo-sqlite's web build
 * keeps databases in an OPFS pool that only one window may hold, and its
 * wasm SQLite has no FTS5 (search needs it). Electron's node:sqlite has both
 * FTS5 and the trigram tokenizer, and needs no native module, so the same
 * build works on macOS and Windows.
 *
 * Dev: `npm run dev` loads the webapp's Vite dev server instead (GITA_DEV_URL).
 */
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain, Menu, net, protocol, shell, ShareMenu, nativeTheme } = require("electron");
const { DatabaseSync } = require("node:sqlite");

const DEV_URL = process.env.GITA_DEV_URL; // e.g. http://localhost:8095
const WEB_ROOT = path.join(__dirname, "web");
const ORIGIN = "app://gita";

// The database: in the packaged app it sits in Resources (outside the asar,
// so SQLite can read it in place); in dev, straight from the Expo assets.
const DB_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "gita.db")
  : path.join(__dirname, "..", "assets", "db", "gita.db");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// ---------------------------------------------------------------- database
let db = null;
const statements = new Map();

function openDb() {
  db = new DatabaseSync(DB_PATH, { readOnly: true });
}

function statement(sql) {
  let s = statements.get(sql);
  if (!s) {
    s = db.prepare(sql);
    statements.set(sql, s);
  }
  return s;
}

// The page's db.js speaks expo-sqlite's getAllAsync/getFirstAsync; these are the same two calls.
ipcMain.handle("gita-db:all", (_e, sql, params) => statement(sql).all(...(params || [])));
ipcMain.handle("gita-db:first", (_e, sql, params) => statement(sql).get(...(params || [])) ?? null);

// Share: the macOS share menu; elsewhere the page copies to the clipboard instead.
ipcMain.handle("gita:share", (e, text) => {
  if (process.platform !== "darwin" || !ShareMenu) return false;
  const win = BrowserWindow.fromWebContents(e.sender);
  new ShareMenu({ texts: [String(text)] }).popup({ window: win });
  return true;
});

// ---------------------------------------------------------------- app:// (the web export)
function serveWeb(request) {
  const { pathname } = new URL(request.url);
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  let file = path.join(WEB_ROOT, rel);
  if (!file.startsWith(WEB_ROOT)) return new Response("Not found", { status: 404 });
  // Routes (/verse/2/47 …) are client-side: anything that isn't a file is the app's index.html.
  if (!rel || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_ROOT, "index.html");
  return net.fetch(pathToFileURL(file).toString());
}

// ---------------------------------------------------------------- window
function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 820,
    minHeight: 560,
    title: "Gita All-In-One",
    // macOS: traffic lights inset over the sidebar, no separate title bar.
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 18, y: 18 } } : {}),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#161618" : "#fbfaf8",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.once("ready-to-show", () => win.show());

  const own = (url) => url.startsWith(ORIGIN) || (DEV_URL && url.startsWith(DEV_URL));
  // Links out of the app (sources & credits, licences) open in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (own(url)) return;
    e.preventDefault();
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
  });

  win.on("swipe", (_e, dir) => goHistory(win, dir === "left" ? -1 : dir === "right" ? 1 : 0));
  win.loadURL(DEV_URL || `${ORIGIN}/`);
  return win;
}

function goHistory(win, step) {
  const h = win?.webContents.navigationHistory;
  if (step < 0 && h?.canGoBack()) h.goBack();
  if (step > 0 && h?.canGoForward()) h.goForward();
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Go",
      submenu: [
        { label: "Back", accelerator: isMac ? "Cmd+[" : "Alt+Left", click: (_i, win) => goHistory(win, -1) },
        { label: "Forward", accelerator: isMac ? "Cmd+]" : "Alt+Right", click: (_i, win) => goHistory(win, 1) },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    openDb();
    protocol.handle("app", serveWeb);
    buildMenu();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("will-quit", () => db?.close());
}
