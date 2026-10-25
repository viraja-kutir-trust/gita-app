// Tests for src/lib/translate.js (Sanskrit masking, chunking, block round-trip) outside React Native.
// ML Kit is replaced by a fake translator. Run: node scripts/build_db/test/test_translate.mjs
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
let src = readFileSync(path.join(root, "src/lib/translate.js"), "utf8");
src = src.replace(
  'import Sanscript from "@indic-transliteration/sanscript";',
  `import { createRequire } from "node:module";\nconst Sanscript = createRequire(${JSON.stringify(path.join(root, "package.json"))})("@indic-transliteration/sanscript");`
);
src = src.replace(/import \{[^}]*\} from "\.\.\/\.\.\/modules\/mlkit-translate";/, "const translateTexts = null, downloadedModels = async () => [], deleteModel = null, translationAvailable = true;");
src = src.replace('import { fonts } from "../ui/theme";', "const fonts = {};");
const tmp = mkdtempSync(path.join(tmpdir(), "gitatr-"));
const mod = path.join(tmp, "translate.mjs");
writeFileSync(mod, src);
const { mask, unmask, chunk, translateBlocks, translateMeanings, canTranslate } = await import(pathToFileURL(mod).href);

let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? "ok   " : "FAIL ") + msg);
  if (!cond) fails += 1;
};

// Fake translator: upper-cases ordinary letters, writes tokens with Devanagari digits and spaces.
const DEV = "०१२३४५६७८९";
const fake = async (texts) =>
  texts.map((t) => t.replace(/\[\[(\d+)\]\]/g, (_, n) => `[ [${[...n].map((d) => DEV[d]).join("")}] ]`).replace(/[a-z]/g, (ch) => ch.toUpperCase()));

ok(!canTranslate("sanskrit"), "Sanskrit is never translatable");
ok(canTranslate("hindi") && canTranslate("english") && canTranslate("telugu"), "vernaculars are translatable");

const m = mask("When ⟦karmaṇi⟧ is read⁽2⁾, Kṛṣṇa means कर्मण्येव here.", "en");
ok(!/⟦|⁽|ṛ|क/.test(m.text), "pratīka, footnote marker, IAST and Devanagari are masked");
ok(unmask(m.text, m.saved) === "When ⟦karmaṇi⟧ is read⁽2⁾, कृष्ण means कर्मण्येव here.", "unmask restores pieces (IAST kept as Devanagari)");

const h = mask("‘⟦धर्मक्षेत्रे⟧’ — कुरुक्षेत्र में देवताओं ने यज्ञ किया था।", "hi");
ok(h.text.includes("कुरुक्षेत्र") && !h.text.includes("धर्मक्षेत्रे"), "Hindi prose stays, its pratīka is masked");

ok(unmask("no tokens left", ["⟦x⟧", "y"]) === "no tokens left ⟦x⟧", "a dropped pratīka is appended, not lost");

const long = "This is a sentence about duty. ".repeat(80);
const parts = chunk(long);
ok(parts.length > 1 && parts.every((p) => p.length <= 900) && parts.join("") === long, "long paragraphs split on sentences, nothing lost");

const blocks = [
  { type: "heading", text: "commentary" },
  { type: "paragraph", text: "the ⟦yoga⟧ of action⁽1⁾ in Kṛṣṇa's words" },
  { type: "verse_quote", lines: ["कर्मण्येवाधिकारस्ते"], ref: "2.47" },
  { type: "footnotes", items: [{ n: 1, text: "see ⟦karma⟧" }] },
  { type: "paragraph", text: "" },
];
const out = await translateBlocks(blocks, "en", "te", { run: fake });
ok(out.length === blocks.length && out.every((b, i) => b.type === blocks[i].type), "block count and types preserved");
ok(out[0].text === "COMMENTARY", "headings are translated");
ok(out[1].text === "THE ⟦yoga⟧ OF ACTION⁽1⁾ IN कृष्ण'S WORDS", "pratīka, footnote marker and IAST survive translation");
ok(out[2] === blocks[2], "quoted verses are untouched");
ok(out[3].items[0].text === "SEE ⟦karma⟧" && out[3].items[0].n === 1, "footnotes translated, numbers kept");
ok(out[4].text === "", "empty paragraphs stay empty");

const mm = await translateMeanings([{ termIast: "karmaṇi", meaning: "in action" }], "en", "hi", { run: fake });
ok(mm[0].termIast === "karmaṇi" && mm[0].meaning === "IN ACTION", "word meanings: only the gloss is translated");

// Every non-Sanskrit body in the database survives a mask → unmask round trip.
const dbPath = path.join(root, "assets/db/gita.db");
const rows = JSON.parse(
  execFileSync("python3", [path.join(here, "sqlbridge.py")], {
    input: JSON.stringify({ db: dbPath, sql: "select lang, body from texts where lang != 'sanskrit' and body is not null", params: [] }),
    maxBuffer: 1 << 30,
  }).toString()
);
const CODES = { english: "en", hindi: "hi", telugu: "te", tamil: "ta" };
let bad = 0;
let total = 0;
for (const r of rows) {
  for (const b of JSON.parse(r.body)) {
    const texts = b.type === "footnotes" ? (b.items || []).map((f) => f.text) : b.type === "verse_quote" ? [] : [b.text || ""];
    for (const t of texts) {
      total += 1;
      const back = chunk(t).map((c) => {
        const x = mask(c, CODES[r.lang]);
        return unmask(x.text, x.saved);
      }).join("");
      // IAST words come back as Devanagari; compare with them stripped out.
      const norm = (s) => s.replace(/[A-Za-zāīūṛṝḷḹṃṁḥṅñṭḍṇśṣĀĪŪṚṜḶḸṂṀḤṄÑṬḌṆŚṢ]+|[ऀ-ॿ]+/g, "").replace(/\s+/g, "");
      if (norm(back) !== norm(t)) bad += 1;
    }
  }
}
ok(bad === 0, `mask round trip on ${total} vernacular strings from the database (${bad} differ)`);

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
