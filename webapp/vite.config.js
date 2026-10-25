import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The desktop/web UI. Data logic is shared with the phone app (../src/gita-data/api.js,
// ../src/lib/*); everything on screen lives here.
//
// GITA_TARGET=web: a build for browsers, which ships the database (gita.db) next to the
// page and opens it with SQLite's own wasm build. The default (desktop) build leaves it
// out: the Electron app reads the database in its main process.

const ROOT = path.resolve(__dirname, "..");
const DB_FILE = path.join(ROOT, "assets", "db", "gita.db");
const TARGET = process.env.GITA_TARGET || "desktop";

/** ../src/lib/wordMeanings.js loads a JSON file with require() (Metro); turn it into an import. */
function requireJson() {
  return {
    name: "gita-require-json",
    enforce: "pre",
    transform(code, id) {
      if (!id.startsWith(path.join(ROOT, "src")) || !code.includes("require(")) return null;
      let n = 0;
      const imports = [];
      const out = code.replace(/require\((["'])([^"']+\.json)\1\)/g, (_, _q, file) => {
        const name = `__json${n++}`;
        imports.push(`import ${name} from ${JSON.stringify(file)};`);
        return name;
      });
      return n ? { code: `${imports.join("\n")}\n${out}`, map: null } : null;
    },
  };
}

/** /gita.db: served from assets/ in dev, copied into the build for the web target. */
function gitaDb() {
  return {
    name: "gita-db",
    configureServer(server) {
      server.middlewares.use("/gita.db", (_req, res) => {
        res.setHeader("Content-Type", "application/vnd.sqlite3");
        fs.createReadStream(DB_FILE).pipe(res);
      });
    },
    generateBundle() {
      if (TARGET !== "web") return;
      this.emitFile({ type: "asset", fileName: "gita.db", source: fs.readFileSync(DB_FILE) });
    },
  };
}

export default defineConfig({
  plugins: [requireJson(), gitaDb(), react()],
  define: { __GITA_TARGET__: JSON.stringify(TARGET) },
  resolve: { dedupe: ["react", "react-dom", "react-redux"] },
  server: { port: 5173, strictPort: true, fs: { allow: [ROOT] } },
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  worker: { format: "es" },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
