import Sanscript from "@indic-transliteration/sanscript";

/**
 * Word-by-word meanings can come from several teachers. Each source returns the
 * same shape: [{termDev, termIast, meaning, dcsIdx: number[]}] in the order the
 * source glosses the verse; dcsIdx links to the grammar rows (table `words`).
 */
export const WORD_SOURCES = [
  {
    key: "sivananda",
    name: "Swami Sivananda",
    short: "Sivananda",
    lineage: "Advaita · Divine Life Society",
    credit: "Swami Sivananda, The Bhagavad Gita (Divine Life Society)",
  },
  {
    key: "swarupananda",
    name: "Swami Swarupananda",
    short: "Swarupananda",
    lineage: "Ramakrishna Order · Advaita Ashrama, 1909 · 134 verses so far, others from Sivananda",
    credit: "Swami Swarupananda, Srimad Bhagavad Gita (Advaita Ashrama, 1909), public domain",
  },
  {
    key: "mukundananda",
    name: "Swami Mukundananda",
    short: "Mukundananda",
    lineage: "JKYog",
    credit: "Swami Mukundananda, Bhagavad Gita – The Song of God (holy-bhagavad-gita.org)",
  },
];
export const DEFAULT_WORD_SOURCE = "sivananda";
export const wordSourceInfo = (key) => WORD_SOURCES.find((s) => s.key === key) || WORD_SOURCES[0];

// Swarupananda's glosses are digitised separately (scripts/pd_sources) into this
// bundled file; the option appears in Settings once it has verses.
// eslint-disable-next-line global-require
const SWARUPANANDA_FILE = require("../../assets/data/wbw-swarupananda.json");
const SWARUPANANDA = SWARUPANANDA_FILE && Object.keys(SWARUPANANDA_FILE.verses || {}).length ? SWARUPANANDA_FILE : null;
export const availableWordSources = () => WORD_SOURCES.filter((s) => s.key !== "swarupananda" || !!SWARUPANANDA);

const toIast = (dev) => Sanscript.t(dev, "devanagari", "iast").replace(/[|।॥]/g, "").trim();

// Loose comparison key for matching a gloss headword to DCS words across sandhi:
// drop virāma, visarga, anusvāra/candrabindu, avagraha, hyphens and spaces.
const key = (s) => (s || "").replace(/[्ःंँऽ\-\s]/g, "");

/** Link each gloss to the DCS words it covers (greedy, in order). */
function linkToDcs(items, words) {
  let p = 0;
  return items.map((it) => {
    const t = key(it.termDev);
    const out = [];
    let acc = "";
    for (let j = p; j < words.length && out.length < 6; j++) {
      const w = key(words[j].formDev);
      const cand = acc + w;
      if (t.startsWith(cand) || (out.length === 0 && t.startsWith(w.slice(0, Math.max(2, w.length - 2))))) {
        out.push(words[j].idx);
        acc = cand;
        if (acc.length >= t.length - 1) break;
      } else if (out.length) break;
    }
    if (out.length) p = words.findIndex((w) => w.idx === out[out.length - 1]) + 1;
    return { ...it, dcsIdx: out };
  });
}

/** Sivananda opens each commentary with "⟦term⟧ meaning, ⟦term⟧ meaning, …". */
export function parseSivanandaGlosses(blocks) {
  const para = (blocks || []).find((b) => b.type === "paragraph" && /⟦/.test(b.text || ""));
  if (!para) return [];
  const out = [];
  const re = /⟦([^⟧]+)⟧\s*([^⟦]*)/g;
  let m;
  while ((m = re.exec(para.text))) {
    const termDev = m[1].trim();
    const meaning = m[2]
      .trim()
      .replace(/^[—–-]\s*/, "")
      .replace(/[,;.]\s*$/, "")
      .trim();
    if (!termDev || !meaning) continue;
    out.push({ termDev, termIast: toIast(termDev), meaning });
  }
  return out;
}

/** Build the word list for one verse from the chosen source. */
export async function getWordMeanings(gita, source, verse) {
  const { words = [], meanings = [] } = await gita.getWords(verse.id);
  // Chosen source first; Swarupananda's partial 1909 set falls back to Sivananda.
  const order = source === "swarupananda" ? ["swarupananda", "sivananda"] : [source];
  for (const src of order) {
    if (src === "sivananda") {
      const texts = await gita.getTexts(verse.id, { type: "commentary", authorIds: [16] });
      const own = texts.find((t) => t.verseId === verse.id) || texts[0];
      const items = own ? parseSivanandaGlosses(own.blocks) : [];
      if (items.length) return { source: src, fellBack: src !== source, words, meanings: linkToDcs(items, words) };
    }
    if (src === "swarupananda" && SWARUPANANDA) {
      const v = SWARUPANANDA.verses?.[`${verse.chapter}.${verse.verse}`];
      if (v?.words?.length) {
        const items = v.words.map((w) => ({ termDev: w.term_dev, termIast: w.term_iast || toIast(w.term_dev || ""), meaning: w.meaning }));
        return { source: src, words, meanings: linkToDcs(items, words) };
      }
    }
  }
  // Mukundananda (built into the database), also the fallback when a source skips a verse.
  return {
    source: "mukundananda",
    fellBack: source !== "mukundananda",
    words,
    meanings: meanings.map((m) => ({ termDev: m.termDev, termIast: m.termIast, meaning: m.meaning, dcsIdx: m.dcsIdx || [] })),
  };
}
