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
    key: "nirvikalpananda",
    name: "Swami Nirvikalpananda",
    short: "Nirvikalpananda",
    lineage: "Ramakrishna Order · తెలుగు (Telugu meanings, padaccheda)",
    credit: "Swami Nirvikalpananda, Srimad Bhagavad Gita (Telugu), with word-by-word meaning and translation",
    lang: "telugu",
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
const teToDev = (te) => Sanscript.t(te || "", "telugu", "devanagari");

// Loose comparison key for matching a gloss headword to DCS words across sandhi:
// drop virāma, visarga, anusvāra/candrabindu, avagraha, hyphens and spaces.
const key = (s) => (s || "").replace(/[्ःंँऽ\-\s]/g, "");

/** Link each gloss to the DCS words it covers (greedy, in order). */
function linkToDcs(items, words) {
  let p = 0;
  const used = new Set();
  const match = (t, from) => {
    const out = [];
    let acc = "";
    for (let j = from; j < words.length && out.length < 6; j++) {
      if (!out.length && used.has(words[j].idx)) continue;
      const w = key(words[j].formDev);
      const cand = acc + w;
      if (t.startsWith(cand) || (out.length === 0 && t.startsWith(w.slice(0, Math.max(2, w.length - 2))))) {
        out.push(words[j].idx);
        acc = cand;
        if (acc.length >= t.length - 1) break;
      } else if (out.length) break;
    }
    return out;
  };
  return items.map((it) => {
    if (it.implied) return { ...it, dcsIdx: [] }; // a word the reader supplies, not in the verse
    const t = key(it.termDev);
    // Glosses mostly follow the verse; a prose-order (anvaya) list jumps around, so look again from the start.
    let out = match(t, p);
    if (!out.length) out = match(t, 0);
    out.forEach((i) => used.add(i));
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
    if (src === "nirvikalpananda") {
      // Telugu meanings in the book's order (the anvaya); verses explained together
      // share one list, and a verse the book splits has two units.
      const units = await gita.getStudyUnits(verse.id);
      const items = [];
      units.forEach((u, ui) =>
        (u.words || []).forEach((w) => {
          const termDev = teToDev(w.term);
          items.push({ termDev, termTe: w.term, termIast: toIast(termDev), meaning: w.meaning, implied: !!w.implied, notes: w.term_notes || [], unit: ui });
        })
      );
      if (items.length) return { source: src, lang: "telugu", units, words, meanings: linkToDcs(items, words) };
    }
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

// ---------------------------------------------------------------- tapping a word of the verse
const TAP_PUNCT = /^[।॥|]+$/;
const iastLen = (s) => (s || "").replace(/[^a-zāīūṛṝḷḹṃṁḥṅñṭḍṇśṣ]/gi, "").length;

/**
 * For each surface word of the verse (as printed, with sandhi), the index of the
 * word-by-word entry to open. Goes through the grammar rows, which follow the
 * verse: the token's position picks the verse word, and the entry linked to that
 * word is opened, whatever order the source lists its words in (a prose-order
 * anvaya list included). Falls back to proportional position where no link exists.
 */
export function mapTokensToMeanings(iastLines, meanings, words) {
  const toks = iastLines.flatMap((l) => l.replace(/[|।॥]/g, " ").split(/\s+/)).filter((t) => t && !TAP_PUNCT.test(t));
  return matchTokens(toks, meanings, words).map((x) => x.k);
}

/**
 * For each padaccheda word (Telugu, as printed: "ఆకాశ స్థితః"), the word-by-word
 * entries it covers. Usually one; a padaccheda word the list glosses in parts gives
 * several, and an entry that joins several padaccheda words is given to each of them.
 */
export function mapPadacchedaToMeanings(items, meanings, words) {
  const parts = items.map((it) =>
    Sanscript.t(it.replace(/⁽\d+⁾/g, ""), "telugu", "iast")
      .split(/\s+/)
      .filter(Boolean)
  );
  const found = matchTokens(parts.flat(), meanings, words);
  const keys = entryKeys(meanings);
  let at = 0;
  return parts.map((ps) => {
    const mine = found.slice(at, at + ps.length);
    at += ps.length;
    // One entry that glosses every word of it ("ati svapnaśīlasya") beats a mix of entries.
    if (ps.length > 1) {
      const whole = keys.findIndex((ws) => ps.every((p) => matchRank(plain(p), ws)));
      if (whole >= 0) return [whole];
    }
    // Text matches are certain; a guess only stands in when nothing matched.
    const sure = [...new Set(mine.filter((x) => x.sure).map((x) => x.k))];
    return sure.length ? sure : mine.length ? [mine[0].k] : [];
  });
}

// Letters only; an anusvāra before a consonant reads as its nasal (saṃjaya = sañjaya).
const plain = (x) =>
  (x || "")
    .normalize("NFD")
    .replace(/[^a-z]/gi, "")
    .toLowerCase()
    .replace(/m(?=[bcdfghjklnpqrstvwxyz])/g, "n");

/** Each word of each entry ("śaraṇaṃ vraja" has two), trimmed of the endings sandhi changes. */
function entryKeys(meanings) {
  return meanings.map((m) =>
    (m.termIast || "")
      .split(/[\s-]+/)
      .map((w) => {
        const full = plain(w);
        const k = full.replace(/(h|m)$/, ""); // visarga / anusvāra
        return { full, k: k.length > 3 ? k.slice(0, -1) : k }; // and the last vowel
      })
      .filter((x) => x.k)
  );
}

/** Best place one of an entry's words appears in a token: [position, exact ? 0 : 1, -length], or null. */
function matchRank(tp, ws) {
  let best = null;
  for (const { full, k } of ws) {
    // Short words (mā, ca, na) only count at the start of the tapped word.
    const i = k.length >= 3 ? tp.indexOf(k) : tp.startsWith(k) ? 0 : -1;
    if (i < 0) continue;
    const r = [i, tp === full ? 0 : 1, -k.length];
    if (!best || r[0] < best[0] || (r[0] === best[0] && (r[1] < best[1] || (r[1] === best[1] && r[2] < best[2])))) best = r;
  }
  return best;
}

/** [{k: entry index, sure: matched by its text}] for each IAST token, in verse order. */
function matchTokens(toks, meanings, words) {
  const spans = [];
  let at = 0;
  for (const t of toks) {
    spans.push([at, at + iastLen(t)]);
    at += iastLen(t);
  }
  const total = at || 1;

  // Proportional guess: entries assumed to follow the verse.
  const ml = meanings.map((m) => iastLen(m.termIast));
  const mTotal = ml.reduce((a, b) => a + b, 0) || 1;
  const byPosition = spans.map(([a, b]) => {
    const mid = ((a + b) / 2) * (mTotal / total);
    let acc = 0;
    for (let j = 0; j < ml.length; j++) {
      acc += ml[j];
      if (acc >= mid) return j;
    }
    return Math.max(0, meanings.length - 1);
  });

  // 1. The entry whose term is written inside the tapped word (earliest first, so a
  //    sandhi cluster like matsthānītyupadhāraya opens its first word).
  const entryWords = entryKeys(meanings);
  const byText = toks.map((t) => {
    const tp = plain(t);
    let best = -1;
    let rank = null;
    entryWords.forEach((ws, j) => {
      const r = matchRank(tp, ws);
      // Earliest in the tapped word, then an exact word, then the longest.
      if (r && (!rank || r[0] < rank[0] || (r[0] === rank[0] && (r[1] < rank[1] || (r[1] === rank[1] && r[2] < rank[2]))))) {
        best = j;
        rank = r;
      }
    });
    return best;
  });
  if (!words?.length || !meanings.some((m) => m.dcsIdx?.length)) return byText.map((k, i) => (k >= 0 ? { k, sure: true } : { k: byPosition[i], sure: false }));

  // Grammar rows laid out along the verse.
  const wl = words.map((w) => iastLen(w.form));
  const scale = total / (wl.reduce((a, b) => a + b, 0) || 1);
  const wSpans = [];
  let w0 = 0;
  for (const n of wl) {
    wSpans.push([w0 * scale, (w0 + n) * scale]);
    w0 += n;
  }
  const entryOf = new Map();
  meanings.forEach((m, k) => (m.dcsIdx || []).forEach((i) => entryOf.has(i) || entryOf.set(i, k)));
  return spans.map(([a, b], ti) => {
    // Verse words inside this token, those starting in it first.
    const inside = words
      .map((w, j) => ({ w, s: wSpans[j], over: Math.min(b, wSpans[j][1]) - Math.max(a, wSpans[j][0]) }))
      .filter((x) => x.over > 0)
      .sort((x, y) => (x.s[0] >= a ? 0 : 1) - (y.s[0] >= a ? 0 : 1) || x.s[0] - y.s[0]);
    if (byText[ti] >= 0) return { k: byText[ti], sure: true };
    // 2. The entry linked to the verse word at this position; 3. position alone.
    for (const x of inside) if (entryOf.has(x.w.idx)) return { k: entryOf.get(x.w.idx), sure: false };
    return { k: byPosition[ti], sure: false };
  });
}
