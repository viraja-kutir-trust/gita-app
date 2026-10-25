import Sanscript from "@indic-transliteration/sanscript";
import { fonts } from "../ui/theme";

// Scripts the Sanskrit can be shown in. `scheme` is the sanscript scheme name.
// Tamil uses the superscripted scheme (க², ப⁴ …): the "extended" scheme emits
// Grantha code points that most phones cannot render.
export const SCRIPTS = [
  { key: "dv", label: "देवनागरी", name: "Devanagari", scheme: "devanagari", font: fonts.sanskrit },
  { key: "te", label: "తెలుగు", name: "Telugu", scheme: "telugu", font: "NotoSerifTelugu_400Regular" },
  { key: "kn", label: "ಕನ್ನಡ", name: "Kannada", scheme: "kannada", font: "NotoSerifKannada_400Regular" },
  { key: "ta", label: "தமிழ்", name: "Tamil", scheme: "tamil_superscripted", font: "NotoSerifTamil_400Regular" },
  { key: "ml", label: "മലയാളം", name: "Malayalam", scheme: "malayalam", font: "NotoSerifMalayalam_400Regular" },
  { key: "bn", label: "বাংলা", name: "Bengali", scheme: "bengali", font: "NotoSerifBengali_400Regular" },
  { key: "gu", label: "ગુજરાતી", name: "Gujarati", scheme: "gujarati", font: "NotoSerifGujarati_400Regular" },
  { key: "ro", label: "IAST", name: "Roman (IAST)", scheme: "iast", font: fonts.sanskrit },
];

export const scriptByKey = Object.fromEntries(SCRIPTS.map((s) => [s.key, s]));

// Old app stored the script by display name ("Telugu", "Tamil" …).
export function scriptKeyFromLegacy(name) {
  const n = String(name || "").toLowerCase();
  const hit = SCRIPTS.find((s) => s.name.toLowerCase().startsWith(n) || s.scheme.startsWith(n));
  return hit ? hit.key : "dv";
}

const cache = new Map();

/** Devanagari → chosen script. Devanagari dandas (। ॥) are kept: all Indic scripts share them. */
export function toScript(text, key) {
  if (!text || key === "dv") return text;
  const s = scriptByKey[key] || scriptByKey.dv;
  const ck = key + "\u0000" + text;
  let out = cache.get(ck);
  if (out === undefined) {
    out = Sanscript.t(text, "devanagari", s.scheme);
    if (key === "ro") out = out.replace(/\|\|/g, "॥").replace(/\|/g, "।");
    if (cache.size > 4000) cache.clear();
    cache.set(ck, out);
  }
  return out;
}

const teCache = new Map();

/**
 * Telugu text (Swami Nirvikalpananda's book) → chosen script. "te" returns it as
 * printed; footnote markers and punctuation pass through unchanged.
 */
export function fromTelugu(text, key) {
  if (!text || key === "te") return text;
  const s = scriptByKey[key] || scriptByKey.dv;
  const ck = key + "\u0000" + text;
  let out = teCache.get(ck);
  if (out === undefined) {
    out = Sanscript.t(text, "telugu", s.scheme);
    if (key === "ro") out = out.replace(/\|\|/g, "॥").replace(/\|/g, "।");
    if (teCache.size > 4000) teCache.clear();
    teCache.set(ck, out);
  }
  return out;
}

const DEVA_DIGITS = "०१२३४५६७८९";

/** Verse number in the chosen script's digits ("४७", "౪౭", "47"). */
export function scriptDigits(n, key) {
  const deva = String(n).replace(/[0-9]/g, (d) => DEVA_DIGITS[Number(d)]);
  if (key === "ro") return String(n);
  if (key === "ta") return String(n); // Tamil numerals are rarely used for verse numbers
  return toScript(deva, key);
}

export function scriptFont(key) {
  return (scriptByKey[key] || scriptByKey.dv).font;
}
