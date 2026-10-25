/**
 * Build the desktop UI (webapp/, Vite + React) into electron/web/, which the app
 * loads from app://gita. The database is not part of it: it ships in Resources
 * (see "extraResources" in electron/package.json) and is read by main.js.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const webapp = path.join(__dirname, "..", "..", "webapp");
const out = path.join(__dirname, "..", "web");

if (!fs.existsSync(path.join(webapp, "node_modules"))) execSync("npm install", { cwd: webapp, stdio: "inherit" });
execSync("npx vite build", { cwd: webapp, stdio: "inherit" });
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(webapp, "dist"), out, { recursive: true });
console.log("electron/web ready");
