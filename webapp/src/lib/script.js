import Sanscript from "@indic-transliteration/sanscript";

// Scripts the Sanskrit can be shown in (same keys as the phone app's lib/script.js).
// Tamil uses the superscripted scheme (க², ப⁴ …): the "extended" one emits Grantha
// code points few fonts have.
export const SCRIPTS = [
  { key: "dv", label: "देवनागरी", name: "Devanagari", scheme: "devanagari", font: "var(--font-deva)" },
  { key: "te", label: "తెలుగు", name: "Telugu", scheme: "telugu", font: "var(--font-telugu)" },
  { key: "kn", label: "ಕನ್ನಡ", name: "Kannada", scheme: "kannada", font: "var(--font-kannada)" },
  { key: "ta", label: "தமிழ்", name: "Tamil", scheme: "tamil_superscripted", font: "var(--font-tamil)" },
  { key: "ml", label: "മലയാളം", name: "Malayalam", scheme: "malayalam", font: "var(--font-malayalam)" },
  { key: "bn", label: "বাংলা", name: "Bengali", scheme: "bengali", font: "var(--font-bengali)" },
  { key: "gu", label: "ગુજરાતી", name: "Gujarati", scheme: "gujarati", font: "var(--font-gujarati)" },
  { key: "ro", label: "IAST", name: "Roman (IAST)", scheme: "iast", font: "var(--font-serif)" },
];
export const scriptByKey = Object.fromEntries(SCRIPTS.map((s) => [s.key, s]));
export const scriptFont = (key) => (scriptByKey[key] || scriptByKey.dv).font;

const cache = new Map();
function convert(text, from, key) {
  const s = scriptByKey[key] || scriptByKey.dv;
  const ck = `${from}\u0000${key}\u0000${text}`;
  let out = cache.get(ck);
  if (out === undefined) {
    out = Sanscript.t(text, from, s.scheme);
    if (key === "ro") out = out.replace(/\|\|/g, "॥").replace(/\|/g, "।");
    if (cache.size > 6000) cache.clear();
    cache.set(ck, out);
  }
  return out;
}

/** Devanagari → chosen script (dandas kept: every Indic script uses them). */
export const toScript = (text, key) => (!text || key === "dv" ? text : convert(text, "devanagari", key));

/** Telugu (Swami Nirvikalpananda's book) → chosen script; "te" leaves it as printed. */
export const fromTelugu = (text, key) => (!text || key === "te" ? text : convert(text, "telugu", key));

const DEVA_DIGITS = "०१२३४५६७८९";
export const devaDigits = (n) => String(n).replace(/[0-9]/g, (d) => DEVA_DIGITS[Number(d)]);

/** Verse number in the script's own digits (Roman and Tamil keep 0-9). */
export function scriptDigits(n, key) {
  if (key === "ro" || key === "ta") return String(n);
  return toScript(devaDigits(n), key);
}

const DEVA_RUN = /[ऀ-ॿ꣠-ꣿ]+(?:[\s‌‍]+[ऀ-ॿ꣠-ꣿ]+)*/g;
/** Devanagari runs inside English/other text → chosen script. */
export const convertDeva = (text, key) => (!key || key === "dv" || !text ? text : text.replace(DEVA_RUN, (m) => toScript(m, key)));

/** Verse lines in a script; IAST from the stored transliteration. */
export function verseLines(verse, key) {
  if (!verse) return [];
  return key === "ro" ? verse.iastLines.map((l) => l.replace(/\|\|/g, "॥").replace(/\|/g, "।")) : verse.lines.map((l) => toScript(l, key));
}

export const LANG_FONT = {
  sanskrit: "var(--font-deva)",
  hindi: "var(--font-deva)",
  english: "var(--font-serif)",
  telugu: "var(--font-telugu)",
  tamil: "var(--font-tamil)",
};
