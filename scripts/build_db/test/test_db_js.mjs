// Smoke test for src/gita-data/db.js against assets/db/gita.db (outside React Native).
// Run: node scripts/build_db/test/test_db_js.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const dbPath = path.join(root, "assets/db/gita.db");
let src = readFileSync(path.join(root, "src/gita-data/db.js"), "utf8");
src = src.replace('import * as SQLite from "expo-sqlite";', "const SQLite = {};");
src = src.replaceAll(`require("../../assets/db/gita.db")`, "0");
const tmp = mkdtempSync(path.join(tmpdir(), "gitadb-"));
const mod = path.join(tmp, "db.mjs");
writeFileSync(mod, src);
const { createGitaDb, detectQueryType, foldPhonetic, normDeva } = await import(pathToFileURL(mod).href);

const run = (sql, params) =>
  JSON.parse(execFileSync("python3", [path.join(here, "sqlbridge.py")], { input: JSON.stringify({ db: dbPath, sql, params }) }).toString());
const fake = {
  getAllAsync: async (sql, params) => run(sql, params || []),
  getFirstAsync: async (sql, params) => run(sql, params || [])[0] ?? null,
};
const g = createGitaDb(fake);
let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? "ok   " : "FAIL ") + msg);
  if (!cond) fails += 1;
};

ok(detectQueryType("2.47") === "verse" && detectQueryType("2:47") === "verse" && detectQueryType("2 47") === "verse", "verse refs");
ok(detectQueryType("२.४७") === "verse", "Devanagari digits ref");
ok(detectQueryType("कर्मण्येव") === "devanagari" && detectQueryType("karmaṇye") === "iast" && detectQueryType("karmanye") === "ascii", "script detection");
ok(foldPhonetic("Krishna") === foldPhonetic("kṛṣṇa"), "phonetic fold krishna == kṛṣṇa");
ok(normDeva("सम्मोह") === normDeva("संमोह"), "normDeva nasal");

const chs = await g.getChapters();
ok(chs.length === 18 && chs[1].verseCount === 72, "18 chapters, ch2 has 72 verses");
const v = await g.getVerse(2, 47);
ok(v && v.lines.length === 2 && v.lines[1].endsWith(" ॥"), "2.47 has 2 lines ending ॥");
const v121 = await g.getVerse(12, 1);
ok(v121.speaker === "अर्जुन उवाच" && v121.lines[1].startsWith("ये चाप्य"), "12.1 speaker split + 'ये चाप्य' fixed");
ok((await g.getVersesInChapter(13)).length === 35, "ch13 has 35 verses");
const tr = await g.getTexts(v.id, { type: "translation" });
ok(tr.length >= 9 && tr.every((t) => Array.isArray(t.blocks)), "2.47 translations with blocks: " + tr.length);
const ta = await g.getTexts((await g.getVerse(1, 5)).id, { authorIds: [25] });
ok(ta.length === 1, "Tamil text found for 1.5");
const w = await g.getWords(v.id);
ok(w.words.length > 5 && w.meanings.length > 5 && w.words[0].morph.includes("·"), "words + meanings for 2.47");
const au = await g.getAudioUrl(18, 78);
ok(au && /18\/78\.mp3$/.test(au.url), "audio 18.78 " + (au && au.url));
const a = await g.getAuthors({ type: "commentary" });
ok(a.length >= 16, "commentary authors: " + a.length);

for (const [q, opt, want] of [
  ["2.47", {}, (r) => r.jump && r.jump.verseId === v.id],
  ["karmanye", { scope: "verses" }, (r) => r.results[0]?.chapter === 2 && r.results[0]?.verse === 47],
  ["karmaṇyevādhikāraste", { scope: "verses" }, (r) => r.results[0]?.verse === 47],
  ["कर्मण्येवाधिकारस्ते", { scope: "verses" }, (r) => r.results[0]?.verse === 47],
  ["krishna", { scope: "verses" }, (r) => r.results.length > 0],
  ["dharmakshetre", { scope: "verses" }, (r) => r.results[0]?.verse === 1 && r.results[0]?.chapter === 1],
  ["Kurukshetra", { scope: "translations" }, (r) => r.results.length > 0 && r.results[0].matches.length > 0],
  ["अविनाशि", { scope: "commentaries", chapter: 2 }, (r) => r.results.length > 0 && r.results.every((x) => x.chapter === 2)],
  ["sthitaprajna", { scope: "all", limit: 5 }, (r) => r.results.length > 0],
]) {
  const r = await g.search(q, opt);
  const top = r.results[0];
  ok(want(r), `search ${JSON.stringify(q)} ${JSON.stringify(opt)} -> ${r.queryType}, ${r.results.length} hits` +
    (top ? `, top ${top.kind} ${top.chapter}.${top.verse}: ${JSON.stringify(top.snippet.slice(0, 60))} ${JSON.stringify(top.matches.slice(0, 2))}` : ""));
}
process.exit(fails ? 1 : 0);
