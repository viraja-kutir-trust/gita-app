// SQLite in a browser (no Electron): the official wasm build, which includes FTS5 and
// the trigram tokenizer that search needs. The database is read-only, so it is loaded
// into memory once (the browser's HTTP cache keeps the file between visits).
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

let ready = null;

async function open(url) {
  const sqlite3 = await sqlite3InitModule();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load the Gita database (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const db = new sqlite3.oo1.DB();
  const p = sqlite3.wasm.allocFromTypedArray(bytes);
  const { capi } = sqlite3;
  const rc = capi.sqlite3_deserialize(db.pointer, "main", p, bytes.length, bytes.length, capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_READONLY);
  db.checkRc(rc);
  return db;
}

self.onmessage = async ({ data: { id, op, url, sql, params } }) => {
  try {
    if (op === "open") {
      ready = ready || open(url);
      await ready;
      return self.postMessage({ id, result: true });
    }
    const db = await ready;
    const rows = db.selectObjects(sql, params && params.length ? params : undefined);
    self.postMessage({ id, result: op === "first" ? rows[0] ?? null : rows });
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
