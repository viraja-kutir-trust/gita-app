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

// Pausal form without its final visarga/anusvāra, letters only (saṅgaḥ → sanga).
const pausal = (x) => plain(x).replace(/[hm]$/, "");

/**
 * Link each gloss to the DCS words it covers. First exact matches: the gloss's words
 * (karma-phala-hetuḥ) spell out a run of DCS words in their pausal form. Then, for
 * the rest, a loose match on the printed forms that tolerates sandhi at the ends.
 */
function linkToDcs(items, words) {
  const used = new Set();
  const wk = words.map((w) => pausal(w.unsandhied || w.form));
  const exact = (it, from) => {
    const t = (it.termIast || "").split(/[\s-]+/).map(pausal).join("");
    if (!t) return [];
    for (const [a, b] of [[from, words.length], [0, from]]) {
      for (let j = a; j < b; j++) {
        if (used.has(words[j].idx) || !t.startsWith(wk[j])) continue;
        const out = [];
        let acc = "";
        for (let k = j; k < words.length && out.length < 6 && !used.has(words[k].idx); k++) {
          if (!t.startsWith(acc + wk[k])) break;
          acc += wk[k];
          out.push(words[k].idx);
          if (acc === t) return out;
        }
      }
    }
    return [];
  };
  const links = items.map(() => null);
  let p = 0;
  items.forEach((it, n) => {
    if (it.implied) return;
    const out = exact(it, p);
    if (!out.length) return;
    out.forEach((i) => used.add(i));
    links[n] = out;
    p = words.findIndex((w) => w.idx === out[out.length - 1]) + 1;
  });
  return looseLink(items, words, used, links);
}

function looseLink(items, words, used, links) {
  let p = 0;
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
    // Only when the words found spell (nearly) the whole term, not just its start.
    return Math.abs(acc.length - t.length) <= 2 ? out : [];
  };
  return items.map((it, n) => {
    if (it.implied) return { ...it, dcsIdx: [] }; // a word the reader supplies, not in the verse
    if (links[n]) {
      p = words.findIndex((w) => w.idx === links[n][links[n].length - 1]) + 1;
      return { ...it, dcsIdx: links[n] };
    }
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
 * For each surface word of the verse (as printed, with sandhi), the word-by-word
 * entries to open, in verse order. A word printed with sandhi holds several words
 * (karmaṇyevādhikāraste = karmaṇi eva adhikāraḥ te), and all of them open together.
 * Goes through the grammar rows, which follow the verse, so it works whatever order
 * the source lists its words in (a prose-order anvaya list included).
 */
export function mapTokensToMeanings(iastLines, meanings, words) {
  const toks = iastLines.flatMap((l) => l.replace(/[|।॥]/g, " ").split(/\s+/)).filter((t) => t && !TAP_PUNCT.test(t));
  return matchTokens(toks, meanings, words).map((x) => x.ks);
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
    // Text and grammar matches are certain; a guess only stands in when nothing matched.
    const sure = [...new Set(mine.filter((x) => x.sure).flatMap((x) => x.ks))];
    return sure.length ? sure : mine.length ? mine[0].ks.slice(0, 1) : [];
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

/**
 * Which grammar rows (indexes into `words`) each token holds. Sandhi only changes a
 * few letters where words meet, so the letters of the verse words, read in order,
 * are aligned with the letters of the tokens; each word goes to the token most of
 * its letters landed in. Text on one side only costs nothing at either end: the
 * speaker ("śrībhagavān uvāca") the grammar lists but the printed lines don't, or
 * a padaccheda that also covers a neighbouring half-verse.
 */
function wordsPerToken(toks, words) {
  const S = [];
  toks.forEach((t, ti) => {
    for (const ch of plain(t)) S.push([ch, ti]);
  });
  const D = [];
  words.forEach((w, wi) => {
    for (const ch of plain(w.form || w.unsandhied)) D.push([ch, wi]);
  });
  const n = D.length;
  const m = S.length;
  const out = toks.map(() => []);
  if (!n || !m) return out;
  // Overlap alignment: +2 a matching letter, -1 a mismatch or a skipped letter.
  const W = m + 1;
  const score = new Int32Array((n + 1) * W);
  const move = new Uint8Array((n + 1) * W); // 1 pair letters, 2 skip a word letter, 3 skip a token letter
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = score[(i - 1) * W + j - 1] + (D[i - 1][0] === S[j - 1][0] ? 2 : -1);
      const up = score[(i - 1) * W + j] - 1;
      const left = score[i * W + j - 1] - 1;
      let best = diag;
      let mv = 1;
      if (up > best) (best = up), (mv = 2);
      if (left > best) (best = left), (mv = 3);
      score[i * W + j] = best;
      move[i * W + j] = mv;
    }
  }
  // Best end on the last row or column; whatever lies beyond it is unpaired.
  let bi = n;
  let bj = 0;
  for (let j = 1; j <= m; j++) if (score[n * W + j] > score[bi * W + bj]) (bi = n), (bj = j);
  for (let i = 1; i <= n; i++) if (score[i * W + m] > score[bi * W + bj]) (bi = i), (bj = m);
  const votes = words.map(() => new Map());
  let i = bi;
  let j = bj;
  let near = S[Math.max(0, bj - 1)][1];
  const pending = [];
  while (i > 0 && j > 0) {
    const mv = move[i * W + j];
    if (mv === 1) {
      const wi = D[i - 1][1];
      near = S[j - 1][1];
      votes[wi].set(near, (votes[wi].get(near) || 0) + 1);
      i--;
      j--;
    } else if (mv === 2) {
      pending.push([D[i - 1][1], near]); // a letter with no partner: stays with its neighbour
      i--;
    } else j--;
  }
  for (const [wi, t] of pending) if (!votes[wi].size) votes[wi].set(t, 0.5);
  votes.forEach((v, wi) => {
    let tok = -1;
    let most = -1;
    v.forEach((c, t) => {
      if (c > most || (c === most && t < tok)) (tok = t), (most = c);
    });
    if (tok >= 0) out[tok].push(wi);
  });
  return out;
}

/** [{ks: entry indexes, sure: matched by text or grammar}] for each IAST token, in verse order. */
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

  // The entry whose term is written inside the tapped word (earliest first), for
  // tokens whose verse words have no linked entry.
  const entryWords = entryKeys(meanings);
  const byRank = [];
  const byText = toks.map((t, ti) => {
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
    byRank[ti] = rank;
    return best;
  });
  if (!words?.length || !meanings.some((m) => m.dcsIdx?.length)) return byText.map((k, i) => (k >= 0 ? { ks: [k], sure: true } : { ks: [byPosition[i]], sure: false }));

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
  const held = wordsPerToken(toks, words);
  return spans.map(([a, b], ti) => {
    // 1. Every entry linked to a verse word this token holds (all words of a sandhi).
    const linked = [...new Set(held[ti].map((wi) => entryOf.get(words[wi].idx)).filter((k) => k !== undefined))];
    // A verse word here with no linked entry: add the entry whose term is written in
    // the token (matsthānītyupadhāraya → mat-sthāni, besides iti and upadhāraya).
    const gap = held[ti].some((wi) => !entryOf.has(words[wi].idx));
    if (gap && byText[ti] >= 0 && !linked.includes(byText[ti])) {
      if (byRank[ti]?.[0] === 0) linked.unshift(byText[ti]);
      else linked.push(byText[ti]);
    }
    if (linked.length) return { ks: linked, sure: true };
    // Verse words inside this token, those starting in it first.
    const inside = words
      .map((w, j) => ({ w, s: wSpans[j], over: Math.min(b, wSpans[j][1]) - Math.max(a, wSpans[j][0]) }))
      .filter((x) => x.over > 0)
      .sort((x, y) => (x.s[0] >= a ? 0 : 1) - (y.s[0] >= a ? 0 : 1) || x.s[0] - y.s[0]);
    // 2. The entry whose term is written in the token; 3. the entry linked to the verse
    //    word at this position; 4. position alone.
    if (byText[ti] >= 0) return { ks: [byText[ti]], sure: true };
    for (const x of inside) if (entryOf.has(x.w.idx)) return { ks: [entryOf.get(x.w.idx)], sure: false };
    return { ks: [byPosition[ti]], sure: false };
  });
}
