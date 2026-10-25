/**
 * Gita data access on top of the prebuilt SQLite database assets/db/gita.db
 * (built by scripts/build_db, see scripts/build_db/README.md).
 *
 * Written against expo-sqlite ~58 (async API). Two ways to open it:
 *
 *  1) Documented React way (recommended):
 *       import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
 *       import { GITA_DB_PROVIDER_PROPS, createGitaDb } from "./src/gita-data/db";
 *       <SQLiteProvider {...GITA_DB_PROVIDER_PROPS}> ... </SQLiteProvider>
 *       const gita = createGitaDb(useSQLiteContext());
 *
 *  2) Outside React: const gita = await openGitaDb();
 *     (uses expo-sqlite's importDatabaseFromAssetAsync + openDatabaseAsync, the
 *     same steps SQLiteProvider performs for `assetSource`).
 *
 * Requires "db" in metro's resolver.assetExts (metro.config.js) so that
 * require("../../assets/db/gita.db") resolves to an asset.
 *
 * Texts (translations / commentaries) are stored as a JSON array of blocks:
 *   {type: "paragraph", text, label?} | {type: "heading", text}
 *   | {type: "verse_quote", lines: [], text, ref?, meter?}
 *   | {type: "footnotes", items: [{n, text, unanchored?}]}
 * Inside `text`, ⟦…⟧ marks a pratīka (word quoted from the verse) -> render bold,
 * and ⁽n⁾ marks footnote n of the same body.
 */
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import * as SQLite from "expo-sqlite";
import { createGitaDb, detectQueryType, foldAscii, foldPhonetic, normDeva } from "./api";

export const GITA_DB_VERSION = 4;
// A new file name per data version: importDatabaseFromAssetAsync never
// overwrites an existing file, so bump GITA_DB_VERSION whenever gita.db changes.
export const GITA_DB_NAME = `gita-v${GITA_DB_VERSION}.db`;
// eslint-disable-next-line global-require
export const GITA_DB_ASSET = require("../../assets/db/gita.db");
export const GITA_DB_PROVIDER_PROPS = {
  databaseName: GITA_DB_NAME,
  assetSource: { assetId: GITA_DB_ASSET },
};

// The query API lives in api.js (shared with the desktop web app in webapp/).
export * from "./api";

/**
 * The desktop app's database: SQLite in Electron's main process (node:sqlite,
 * built with FTS5), reached through the preload bridge — see electron/main.js.
 */
function desktopDb(bridge) {
  return {
    getAllAsync: (sql, params = []) => bridge.all(sql, params),
    getFirstAsync: (sql, params = []) => bridge.first(sql, params),
  };
}

/**
 * In a plain browser: an in-memory copy of the asset. expo-sqlite's OPFS pool
 * lets only one tab/worker hold the files ("another open Access Handle"), and
 * an import that fails half-way leaves an empty file that later imports skip
 * ("no such table: verses"). Its wasm build has no FTS5, so search fails there;
 * the desktop app does not have that limit.
 */
async function openWebDb() {
  const asset = await Asset.fromModule(GITA_DB_ASSET).downloadAsync();
  const res = await fetch(asset.localUri || asset.uri);
  if (!res.ok) throw new Error(`Could not load the Gita database (${res.status})`);
  return SQLite.deserializeDatabaseAsync(new Uint8Array(await res.arrayBuffer()));
}

/** Open outside React (same steps SQLiteProvider performs for `assetSource`). */
export async function openGitaDb() {
  if (Platform.OS === "web") {
    const bridge = globalThis.gitaDesktop?.db;
    return createGitaDb(bridge ? desktopDb(bridge) : await openWebDb());
  }
  await SQLite.importDatabaseFromAssetAsync(GITA_DB_NAME, { assetId: GITA_DB_ASSET });
  const db = await SQLite.openDatabaseAsync(GITA_DB_NAME);
  return createGitaDb(db);
}

export default { openGitaDb, createGitaDb, GITA_DB_PROVIDER_PROPS, detectQueryType, foldAscii, foldPhonetic, normDeva };
