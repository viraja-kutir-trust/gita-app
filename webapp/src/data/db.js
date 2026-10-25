import { createGitaDb } from "../../../src/gita-data/api";

/**
 * Opens the Gita database and returns the shared query API (../src/gita-data/api.js).
 * Desktop app: SQLite in Electron's main process through the preload bridge.
 * Browser: SQLite wasm in a worker (sqlite.worker.js).
 */
export async function openGitaDb() {
  const bridge = window.gitaDesktop?.db;
  if (bridge) {
    return createGitaDb({
      getAllAsync: (sql, params = []) => bridge.all(sql, params),
      getFirstAsync: (sql, params = []) => bridge.first(sql, params),
    });
  }
  const worker = new Worker(new URL("./sqlite.worker.js", import.meta.url), { type: "module" });
  let seq = 0;
  const pending = new Map();
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    if (data.error) p.reject(new Error(data.error));
    else p.resolve(data.result);
  };
  const call = (msg) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, ...msg });
    });
  await call({ op: "open", url: new URL("/gita.db", location.href).toString() });
  return createGitaDb({
    getAllAsync: (sql, params = []) => call({ op: "all", sql, params }),
    getFirstAsync: (sql, params = []) => call({ op: "first", sql, params }),
  });
}
