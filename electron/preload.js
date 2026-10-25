// The page's window.gitaDesktop: database queries and share, nothing else.
// webapp/src/data/db.js and webapp/src/lib/share.js look for it (and the phone
// UI's src/gita-data/db.js, when it runs on the web).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gitaDesktop", {
  platform: process.platform,
  db: {
    all: (sql, params) => ipcRenderer.invoke("gita-db:all", sql, params),
    first: (sql, params) => ipcRenderer.invoke("gita-db:first", sql, params),
  },
  share: (text) => ipcRenderer.invoke("gita:share", text),
});
