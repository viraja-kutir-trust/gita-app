import Sanscript from "@indic-transliteration/sanscript";
import { deleteModel, downloadedModels, translateTexts, translationAvailable } from "../../modules/mlkit-translate";
import { fonts } from "../ui/theme";

// On-device translation of the vernacular texts (ML Kit). Sanskrit is never
// translated: Sanskrit cards have no translate option, quoted verses are left
// as they are, and Sanskrit words inside a vernacular text (bold pratīkas,
// IAST terms, Devanagari runs) are masked before translation and put back after.

export { translationAvailable, downloadedModels, deleteModel };

/** App language → ML Kit code. Sanskrit is deliberately absent. */
export const SOURCE_CODES = { english: "en", hindi: "hi", telugu: "te", tamil: "ta" };

export const canTranslate = (lang) => translationAvailable && !!SOURCE_CODES[lang];

// `script`: the script Sanskrit is shown in for readers of that language (see lib/script).
// Languages without a bundled font fall back to the system font for their script.
export const TARGETS = [
  { code: "en", name: "English", native: "English", script: "ro", font: fonts.serif },
  { code: "hi", name: "Hindi", native: "हिन्दी", script: "dv", font: fonts.sanskrit },
  { code: "te", name: "Telugu", native: "తెలుగు", script: "te", font: "NotoSerifTelugu_400Regular" },
  { code: "ta", name: "Tamil", native: "தமிழ்", script: "ta", font: "NotoSerifTamil_400Regular" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", script: "kn", font: "NotoSerifKannada_400Regular" },
  { code: "mr", name: "Marathi", native: "मराठी", script: "dv", font: fonts.sanskrit },
  { code: "bn", name: "Bengali", native: "বাংলা", script: "bn", font: "NotoSerifBengali_400Regular" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", script: "gu", font: "NotoSerifGujarati_400Regular" },
  { code: "ur", name: "Urdu", native: "اردو", script: "ro" },
  { code: "es", name: "Spanish", native: "Español", script: "ro", font: fonts.serif },
  { code: "fr", name: "French", native: "Français", script: "ro", font: fonts.serif },
  { code: "de", name: "German", native: "Deutsch", script: "ro", font: fonts.serif },
  { code: "it", name: "Italian", native: "Italiano", script: "ro", font: fonts.serif },
  { code: "pt", name: "Portuguese", native: "Português", script: "ro", font: fonts.serif },
  { code: "nl", name: "Dutch", native: "Nederlands", script: "ro", font: fonts.serif },
  { code: "ru", name: "Russian", native: "Русский", script: "ro", font: fonts.serif },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", script: "ro", font: fonts.serif },
  { code: "ms", name: "Malay", native: "Bahasa Melayu", script: "ro", font: fonts.serif },
  { code: "th", name: "Thai", native: "ไทย", script: "ro" },
  { code: "ja", name: "Japanese", native: "日本語", script: "ro" },
  { code: "zh", name: "Chinese", native: "中文", script: "ro" },
  { code: "ko", name: "Korean", native: "한국어", script: "ro" },
  { code: "ar", name: "Arabic", native: "العربية", script: "ro" },
];

export const targetByCode = Object.fromEntries(TARGETS.map((t) => [t.code, t]));
const LANG_OF_CODE = Object.fromEntries(Object.entries(SOURCE_CODES).map(([l, c]) => [c, l]));
/** The app language name for a target, when the app knows it (for fonts/line heights). */
export const langOfCode = (code) => LANG_OF_CODE[code] || null;

/** Props for <Blocks> showing a text translated into `to`: its font, and Sanskrit in that language's script. */
export function blocksPropsFor(to) {
  const t = targetByCode[to];
  return { lang: langOfCode(to) || "translated", font: t?.font, script: t?.script || "ro", teluguScript: "te" };
}

/** Models that would have to be downloaded before translating from → to. English ships with ML Kit. */
export async function missingModels(from, to) {
  const have = await downloadedModels();
  return [...new Set([from, to])].filter((c) => c !== "en" && !have.includes(c));
}

// ---------------------------------------------------------------- masking
const IAST_MARK = "āīūṛṝḷḹṃṁḥṅñṭḍṇśṣĀĪŪṚṜḶḸṂṀḤṄÑṬḌṆŚṢ";
const IAST_WORD = new RegExp(`[A-Za-z${IAST_MARK}]*[${IAST_MARK}][A-Za-z${IAST_MARK}]*`, "g");
const DEVA_RUN = /[ऀ-ॿ꣠-ꣿ]+(?:[\s‌‍]+[ऀ-ॿ꣠-ꣿ]+)*/g;
const PROTECT = /⟦[^⟧]*⟧|⁽\d+⁾/g;
const DIGIT_ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xff10];
const TOKEN = /\[\s*\[\s*(\p{Nd}+)\s*\]\s*\]/gu;

function asciiDigits(s) {
  return s.replace(/\p{Nd}/gu, (d) => {
    const cp = d.codePointAt(0);
    const zero = DIGIT_ZEROS.filter((z) => z <= cp).pop();
    return String(cp - zero);
  });
}

/**
 * Swap the Sanskrit inside a vernacular string for numbered tokens the
 * translator leaves alone. Returns the masked text and the saved pieces.
 * IAST words are kept as Devanagari so the reader's script setting can show them.
 */
export function mask(text, from) {
  const saved = [];
  const keep = (s) => `[[${saved.push(s) - 1}]]`;
  let out = text.replace(PROTECT, keep);
  if (from !== "hi") out = out.replace(DEVA_RUN, keep);
  out = out.replace(IAST_WORD, (w) => keep(Sanscript.t(w.toLowerCase(), "iast", "devanagari")));
  return { text: out, saved };
}

/** Put the saved pieces back; any the translator dropped are appended so nothing is lost. */
export function unmask(text, saved) {
  const used = new Set();
  let out = text.replace(TOKEN, (m, n) => {
    const i = Number(asciiDigits(n));
    if (saved[i] === undefined) return m;
    used.add(i);
    return saved[i];
  });
  const lost = saved.filter((s, i) => !used.has(i) && /^⟦/.test(s));
  if (lost.length) out += " " + lost.join(" ");
  return out;
}

// ---------------------------------------------------------------- chunking
const MAX_CHUNK = 900;

/** Long paragraphs translate better in sentence-sized pieces. */
export function chunk(text) {
  if (text.length <= MAX_CHUNK) return [text];
  const parts = text.match(/[^.!?।॥]*[.!?।॥]*["'”’)]*\s*/g).filter(Boolean);
  const out = [];
  let cur = "";
  for (const p of parts) {
    if (cur && cur.length + p.length > MAX_CHUNK) {
      out.push(cur);
      cur = "";
    }
    cur += p;
  }
  if (cur) out.push(cur);
  return out;
}

/** Translate many strings in one native call, masking Sanskrit and chunking long ones. */
async function translateStrings(strings, from, to, run = translateTexts) {
  const jobs = strings.map((s) => {
    if (!s || !s.trim()) return { pieces: [] };
    return { pieces: chunk(s).map((c) => mask(c, from)) };
  });
  const flat = jobs.flatMap((j) => j.pieces.map((p) => p.text));
  const done = flat.length ? await run(flat, from, to) : [];
  let k = 0;
  return strings.map((s, i) => {
    if (!jobs[i].pieces.length) return s;
    return jobs[i].pieces.map((p) => unmask(done[k++], p.saved).trim()).join(" ");
  });
}

// ---------------------------------------------------------------- cards
const cache = new Map();
const CACHE_MAX = 60;

async function cached(key, fn) {
  if (cache.has(key)) return cache.get(key);
  const value = await fn();
  cache.set(key, value);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return value;
}

/** A text body (blocks) translated block by block. Quoted verses are untouched. */
export function translateBlocks(blocks, from, to, { key, run } = {}) {
  const go = async () => {
    const strings = [];
    for (const b of blocks || []) {
      if (b.type === "footnotes") (b.items || []).forEach((f) => strings.push(f.text));
      else if (b.type !== "verse_quote") strings.push(b.text || "");
    }
    const out = await translateStrings(strings, from, to, run);
    let k = 0;
    return (blocks || []).map((b) => {
      if (b.type === "footnotes") return { ...b, items: (b.items || []).map((f) => ({ ...f, text: out[k++] })) };
      if (b.type === "verse_quote") return b;
      return { ...b, text: out[k++] };
    });
  };
  return key ? cached(`b:${key}:${to}`, go) : go();
}

/** Word-by-word glosses: only the meanings are translated, never the Sanskrit terms. */
export function translateMeanings(meanings, from, to, { key, run } = {}) {
  const go = async () => {
    const out = await translateStrings((meanings || []).map((m) => m.meaning || ""), from, to, run);
    return (meanings || []).map((m, i) => ({ ...m, meaning: out[i] }));
  };
  return key ? cached(`m:${key}:${to}`, go) : go();
}
