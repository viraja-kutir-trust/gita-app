/**
 * The Gita database's query API, independent of how the database is opened:
 * createGitaDb(db) takes anything with expo-sqlite's getAllAsync/getFirstAsync.
 * Shared by the phone app (src/gita-data/db.js) and the desktop web app (webapp/).
 * See db.js for the data format.
 */
export const PRATIKA_OPEN = "⟦";
export const PRATIKA_CLOSE = "⟧";

// ---------------------------------------------------------------- folding
// MUST stay in sync with scripts/build_db/deva.py (fold_ascii / fold_phonetic / norm)
const ASCII_MAP = {
  ā: "a", ī: "i", ū: "u", ṛ: "r", ṝ: "r", ḷ: "l", ḹ: "l", ṃ: "m", ṁ: "m", ḥ: "h",
  ṅ: "n", ñ: "n", ṭ: "t", ḍ: "d", ṇ: "n", ś: "s", ṣ: "s", ẖ: "h", ḫ: "h", "'": "", "’": "",
};
const PHON_RULES = [
  ["chh", "c"], ["ch", "c"], ["sh", "s"], ["x", "ks"], ["w", "v"], ["ee", "i"], ["oo", "u"],
  ["aa", "a"], ["ii", "i"], ["uu", "u"], ["ri", "r"], ["kh", "k"], ["gh", "g"], ["jh", "j"],
  ["th", "t"], ["dh", "d"], ["ph", "p"], ["bh", "b"], ["f", "p"], ["z", "j"], ["q", "k"],
];

function foldChar(c) {
  const l = c.toLowerCase();
  if (l in ASCII_MAP) return ASCII_MAP[l];
  return l.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** IAST / Latin -> lowercase ASCII (non-Latin characters unchanged). */
export function foldAscii(s) {
  let out = "";
  for (const c of (s || "").normalize("NFC")) out += foldChar(c);
  return out.normalize("NFC");
}

/** Same as foldAscii but also returns, for each output char, its index in s. */
function foldWithMap(s) {
  let out = "";
  const map = [];
  let i = 0;
  for (const c of s) {
    const f = foldChar(c);
    for (let k = 0; k < f.length; k += 1) {
      out += f[k];
      map.push(i);
    }
    i += c.length;
  }
  map.push(i);
  return { out, map };
}

/** Loose phonetic key: 'krishna' / 'kṛṣṇa' / 'krsna' -> 'krsna'. */
export function foldPhonetic(s) {
  let t = foldAscii(s).replace(/[^a-z0-9\s]/g, "");
  for (const [a, b] of PHON_RULES) t = t.split(a).join(b);
  return t.replace(/([a-z])\1+/g, "$1");
}

const VIRAMA = "्";
const isConsonant = (c) => (c >= "क" && c <= "ह") || (c >= "क़" && c <= "य़");
const INDEP_TO_MATRA = {
  अ: "", आ: "ा", इ: "ि", ई: "ी", उ: "ु", ऊ: "ू", ऋ: "ृ", ॠ: "ॄ", ए: "े", ऐ: "ै", ओ: "ो", औ: "ौ",
};

/** Devanagari comparison form (spaces/dandas/avagraha removed, nasals -> anusvara). */
export function normDeva(s) {
  const a = [...(s || "").normalize("NFC")];
  let out = "";
  for (let i = 0; i < a.length; i += 1) {
    const c = a[i];
    if (/[\s।॥|:.\-‌‍ऽ0-9०-९]/.test(c)) continue;
    if ("ङञणनम".includes(c) && a[i + 1] === VIRAMA) {
      let j = i + 2;
      while (j < a.length && a[j] === " ") j += 1;
      if ((j < a.length && isConsonant(a[j])) || (c === "म" && j >= a.length)) {
        out += "ं";
        i += 1;
        continue;
      }
    }
    if (isConsonant(c) && a[i + 1] === VIRAMA) {
      let j = i + 2;
      while (j < a.length && a[j] === " ") j += 1;
      if (j < a.length && a[j] in INDEP_TO_MATRA) {
        out += c + INDEP_TO_MATRA[a[j]];
        i = j;
        continue;
      }
    }
    out += c === "ँ" ? "ं" : c;
  }
  return out;
}

const DEVA_DIGITS = "०१२३४५६७८९";
const toAsciiDigits = (s) => s.replace(/[०-९]/g, (d) => String(DEVA_DIGITS.indexOf(d)));

/** 'verse' | 'chapter' | 'devanagari' | 'iast' | 'ascii' | 'other' */
export function detectQueryType(q) {
  const s = toAsciiDigits((q || "").trim());
  if (/^\d{1,2}\s*[.:,/\s-]\s*\d{1,3}$/.test(s)) return "verse";
  if (/^\d{1,2}$/.test(s)) return "chapter";
  if (/[ऀ-ॿ]/.test(s)) return "devanagari";
  if (/[āīūṛṝḷḹṃṁḥṅñṭḍṇśṣ]/i.test(s)) return "iast";
  if (/^[\x20-\x7e]+$/.test(s)) return "ascii";
  return "other";
}

// ---------------------------------------------------------------- helpers
const parse = (s, fallback = null) => {
  if (s == null) return fallback;
  try {
    return JSON.parse(s);
  } catch (e) {
    return fallback;
  }
};

function verseRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    chapter: r.chapter,
    verse: r.verse,
    speaker: r.speaker, // e.g. 'अर्जुन उवाच' or null
    speakerIast: r.speaker_iast,
    speakerEn: r.speaker_en,
    speakerPosition: r.speaker_position, // pada index the label precedes (0 = before the verse)
    meter: r.meter, // anushtubh | trishtubh | trishtubh-jagati
    lines: parse(r.lines_json, []), // display lines, no verse number
    padas: parse(r.padas_json, []),
    iastLines: parse(r.iast_lines_json, []),
    iastPadas: parse(r.iast_padas_json, []),
    asciiKey: r.ascii_key,
    transliterationLegacy: r.transliteration_legacy,
    wordMeaningsLegacy: r.word_meanings_legacy,
  };
}

const VERSE_COLS =
  "id, chapter, verse, speaker, speaker_iast, speaker_en, speaker_position, meter, lines_json, padas_json, " +
  "iast_lines_json, iast_padas_json, ascii_key, transliteration_legacy, word_meanings_legacy";

export const FOOTNOTE_MARK = /⁽(\d+)⁾/g;

/** Plain text of a block list (pratīka and footnote markers removed, notes left out). */
export function blocksToPlain(blocks) {
  return (blocks || [])
    .filter((b) => b.type !== "footnotes")
    .map((b) => (b.type === "verse_quote" ? b.lines.join("\n") : (b.label ? `${b.label} — ` : "") + b.text))
    .join("\n\n")
    .replace(/[⟦⟧]/g, "")
    .replace(FOOTNOTE_MARK, "");
}

const ftsQuote = (t) => `"${t.replace(/"/g, '""')}"`;

function tokens(q) {
  return q
    .normalize("NFC")
    .split(/[\s,;।॥|"'()[\]{}*:^+]+/)
    .filter(Boolean);
}

/** Find query terms in text (diacritic-insensitive, prefix) and build a snippet. */
function makeSnippet(text, terms, radius = 70) {
  const { out, map } = foldWithMap(text);
  const hay = out;
  const matches = [];
  for (const term of terms) {
    const needle = /[ऀ-෿]/.test(term) ? term : foldAscii(term);
    if (!needle) continue;
    let from = 0;
    for (;;) {
      const k = hay.indexOf(needle, from);
      if (k < 0) break;
      matches.push({ start: map[k], end: map[k + needle.length] });
      from = k + needle.length;
      if (matches.length > 50) break;
    }
  }
  if (!matches.length) {
    // phonetic fallback ('krishna' ~ 'kṛṣṇa'): mark whole words whose phonetic key contains the term's
    const keys = terms.map(foldPhonetic).filter((k) => k.length >= 3);
    if (keys.length) {
      const re = /[^\s|।॥,;.!?—]+/g;
      let m;
      while ((m = re.exec(text))) {
        const wk = foldPhonetic(m[0]);
        if (keys.some((k) => wk.includes(k))) matches.push({ start: m.index, end: m.index + m[0].length });
      }
    }
  }
  matches.sort((a, b) => a.start - b.start);
  if (!matches.length) {
    const s = text.slice(0, radius * 2);
    return { snippet: s + (text.length > s.length ? "…" : ""), matches: [] };
  }
  const first = matches[0].start;
  let start = Math.max(0, first - radius);
  let end = Math.min(text.length, first + radius * 2);
  // snap to word boundaries
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  while (end < text.length && !/\s/.test(text[end])) end += 1;
  const prefix = start > 0 ? "…" : "";
  const snippet = prefix + text.slice(start, end) + (end < text.length ? "…" : "");
  const shift = prefix.length - start;
  return {
    snippet,
    matches: matches
      .filter((m) => m.start >= start && m.end <= end)
      .map((m) => ({ start: m.start + shift, end: m.end + shift })),
  };
}

// ---------------------------------------------------------------- API
export function createGitaDb(db) {
  const all = (sql, ...params) => db.getAllAsync(sql, params);
  const first = (sql, ...params) => db.getFirstAsync(sql, params);
  let authorCache = null;

  async function authorsById() {
    if (!authorCache) {
      const rows = await all("SELECT * FROM authors ORDER BY id");
      authorCache = new Map(rows.map((a) => [a.id, a]));
    }
    return authorCache;
  }

  const api = {
    db,

    async getMeta() {
      const rows = await all("SELECT key, value FROM meta");
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },

    async getChapters() {
      const rows = await all(
        "SELECT number, name_sa, name_translit, name_en, meaning, summary_en, summary_hi, verse_count, image_name FROM chapters ORDER BY number"
      );
      return rows.map((c) => ({
        number: c.number,
        nameSa: c.name_sa,
        nameTranslit: c.name_translit,
        nameEn: c.name_en,
        meaning: c.meaning,
        summaryEn: c.summary_en,
        summaryHi: c.summary_hi,
        verseCount: c.verse_count,
        imageName: c.image_name,
      }));
    },

    async getChapter(n) {
      const c = await first("SELECT * FROM chapters WHERE number = ?", n);
      if (!c) return null;
      return {
        number: c.number,
        nameSa: c.name_sa,
        nameTranslit: c.name_translit,
        nameEn: c.name_en,
        meaning: c.meaning,
        summaryEn: c.summary_en,
        summaryHi: c.summary_hi,
        summaryEnBlocks: parse(c.summary_en_blocks, []),
        summaryHiBlocks: parse(c.summary_hi_blocks, []),
        verseCount: c.verse_count,
        imageName: c.image_name,
      };
    },

    async getVerse(chapter, verse) {
      return verseRow(await first(`SELECT ${VERSE_COLS} FROM verses WHERE chapter = ? AND verse = ?`, chapter, verse));
    },

    async getVerseById(id) {
      return verseRow(await first(`SELECT ${VERSE_COLS} FROM verses WHERE id = ?`, id));
    },

    async getVersesInChapter(n) {
      const rows = await all(`SELECT ${VERSE_COLS} FROM verses WHERE chapter = ? ORDER BY verse`, n);
      return rows.map(verseRow);
    },

    /**
     * Translations / commentaries for a verse.
     * opts: {type: 'translation'|'commentary', authorIds: number[], lang, includePlaceholders}
     * Grouped renderings (e.g. Bharathi's Tamil for 1.4-6) are returned for every verse they cover.
     */
    async getTexts(verseId, opts = {}) {
      const { type, authorIds, lang, includePlaceholders = false } = opts;
      const where = ["t.verse_id BETWEEN ? AND ?", "t.verse_id_end >= ?"];
      const params = [verseId - 10, verseId, verseId];
      if (type) {
        where.push("t.type = ?");
        params.push(type);
      }
      if (lang) {
        where.push("t.lang = ?");
        params.push(lang);
      }
      if (authorIds && authorIds.length) {
        where.push(`t.author_id IN (${authorIds.map(() => "?").join(",")})`);
        params.push(...authorIds);
      }
      if (!includePlaceholders) where.push("t.placeholder = 0");
      const rows = await db.getAllAsync(
        `SELECT t.id, t.verse_id, t.verse_id_end, t.author_id, t.type, t.lang, t.body, t.word_count, t.placeholder,
                a.name AS author_name, a.tradition, a.license, a.attribution
           FROM texts t JOIN authors a ON a.id = t.author_id
          WHERE ${where.join(" AND ")}
          ORDER BY t.type DESC, t.author_id`,
        params
      );
      return rows.map((r) => ({
        id: r.id,
        verseId: r.verse_id,
        verseIdEnd: r.verse_id_end,
        authorId: r.author_id,
        authorName: r.author_name,
        tradition: r.tradition,
        license: r.license,
        attribution: r.attribution,
        type: r.type,
        lang: r.lang,
        blocks: parse(r.body, []),
        wordCount: r.word_count,
        placeholder: !!r.placeholder,
      }));
    },

    /** opts: {type: 'translation'|'commentary'} ('both' authors match either). */
    async getAuthors(opts = {}) {
      const { type } = opts;
      const rows = type
        ? await all("SELECT * FROM authors WHERE kind = ? OR kind = 'both' ORDER BY id", type)
        : await all("SELECT * FROM authors ORDER BY id");
      return rows.map((a) => ({
        id: a.id,
        name: a.name,
        lang: a.lang,
        kind: a.kind,
        tradition: a.tradition,
        era: a.era,
        license: a.license,
        attribution: a.attribution,
        sourceUrl: a.source_url,
        work: a.work,
        publicDomain: !!a.public_domain,
      }));
    },

    /**
     * Word analysis: DCS morphology (CC BY 4.0, Oliver Hellwig) + the legacy word meanings,
     * linked through meanings[i].dcsIdx -> words[j].idx.
     */
    async getWords(verseId) {
      const [words, meanings] = await Promise.all([
        all("SELECT idx, form, unsandhied, form_dev, lemma, lemma_dev, pos, morph FROM words WHERE verse_id = ? ORDER BY idx", verseId),
        all("SELECT idx, term_iast, term_dev, meaning, dcs_idx_json FROM word_meanings WHERE verse_id = ? ORDER BY idx", verseId),
      ]);
      return {
        words: words.map((w) => ({
          idx: w.idx,
          form: w.form,
          unsandhied: w.unsandhied,
          formDev: w.form_dev,
          lemma: w.lemma,
          lemmaDev: w.lemma_dev,
          pos: w.pos,
          morph: w.morph, // e.g. 'noun · locative · singular · neuter'
        })),
        meanings: meanings.map((m) => ({
          idx: m.idx,
          termIast: m.term_iast,
          termDev: m.term_dev,
          meaning: m.meaning,
          dcsIdx: parse(m.dcs_idx_json, []),
        })),
      };
    },

    /**
     * Study material for a verse from one source (default Swami Nirvikalpananda, Telugu):
     * the units (a verse, or verses the book explains together) that cover it, in order.
     * Each: {id, label, verses, verseId, verseIdEnd, blocks: [{lines, verses, padaccheda, speaker?}],
     *        words: [{term, meaning, implied?, term_notes?}], footnotes: [{n, text}], textId}
     * Telugu text throughout; ⁽n⁾ in it refers to `footnotes`.
     */
    async getStudyUnits(verseId, source = "nirvikalpananda") {
      const rows = await all(
        `SELECT u.id, u.verse_id, u.verse_id_end, u.label, u.data
           FROM study_verse_units vu JOIN study_units u ON u.id = vu.unit_id AND u.source = vu.source
          WHERE vu.source = ? AND vu.verse_id = ? ORDER BY vu.ord`,
        source,
        verseId
      ).catch(() => []); // older database without the study tables
      return rows.map((r) => ({ id: r.id, verseId: r.verse_id, verseIdEnd: r.verse_id_end, label: r.label, ...parse(r.data, {}) }));
    },

    /** Chapter intro verse, colophon and their notes from a study source (or null). */
    async getStudyChapter(chapter, source = "nirvikalpananda") {
      const r = await first("SELECT data FROM study_chapters WHERE source = ? AND chapter = ?", source, chapter).catch(() => null);
      return r ? parse(r.data, null) : null;
    },

    /** {url, fallbackUrl, bytes, cdnOk, duplicateOf} – prefer `url`, retry with `fallbackUrl`. */
    async getAudioUrl(chapter, verse) {
      const r = await first(
        "SELECT a.url, a.fallback_url, a.bytes, a.cdn_ok, a.duplicate_of FROM audio a JOIN verses v ON v.id = a.verse_id WHERE v.chapter = ? AND v.verse = ?",
        chapter,
        verse
      );
      if (!r) return null;
      return {
        // jsDelivr refuses uncached files of this repo (>50 MB package limit), so
        // use raw.githubusercontent.com when the CDN check failed at build time.
        url: r.cdn_ok ? r.url : r.fallback_url,
        cdnUrl: r.url,
        fallbackUrl: r.fallback_url,
        bytes: r.bytes,
        cdnOk: !!r.cdn_ok,
        duplicateOf: r.duplicate_of,
      };
    },

    async getSources() {
      return all("SELECT * FROM sources");
    },

    /**
     * Super search.
     * opts: {scope: 'all'|'verses'|'translations'|'commentaries'|'meanings', chapter, authorIds, limit=20, offset=0}
     * Returns {queryType, jump?, results: [{kind, verseId, chapter, verse, authorId?, authorName?, textId?,
     *          snippet, matches: [{start, end}], score}]}
     * `matches` are offsets into `snippet`. Verse hits come first (ranked by bm25), then texts.
     */
    async search(query, opts = {}) {
      const { scope = "all", chapter, authorIds, limit = 20, offset = 0 } = opts;
      const q = (query || "").trim().normalize("NFC");
      const queryType = detectQueryType(q);
      const res = { queryType, results: [] };
      if (!q) return res;

      if (queryType === "verse") {
        const [c, v] = toAsciiDigits(q).split(/\s*[.:,/\s-]\s*/).map(Number);
        const hit = await api.getVerse(c, v);
        if (hit) {
          res.jump = { chapter: c, verse: v, verseId: hit.id };
          res.results.push({ kind: "verse", verseId: hit.id, chapter: c, verse: v, snippet: hit.lines.join("\n"), matches: [], score: 0 });
        }
        return res;
      }
      if (queryType === "chapter") {
        const n = Number(toAsciiDigits(q));
        if (n >= 1 && n <= 18) res.jump = { chapter: n };
      }

      const toks = tokens(q);
      if (!toks.length) return res;
      const chapterFilter = chapter ? " AND v.chapter = ?" : "";
      const chapterParam = chapter ? [chapter] : [];

      // ---- verses (trigram index: substring match in any script)
      if (scope === "all" || scope === "verses" || scope === "meanings") {
        const parts = [];
        for (const t of toks) {
          const alts = [];
          if (queryType === "devanagari") {
            if ([...t].length >= 3) alts.push(`deva : ${ftsQuote(t)}`);
            const n = normDeva(t);
            if ([...n].length >= 3 && n !== t) alts.push(`deva : ${ftsQuote(n)}`);
            if (scope === "meanings" || scope === "all") {
              if ([...t].length >= 3) alts.push(`meanings : ${ftsQuote(t)}`);
            }
          } else {
            const a = foldAscii(t).replace(/[^a-z0-9]/g, "");
            const p = foldPhonetic(t);
            if (scope !== "meanings") {
              if (a.length >= 3) alts.push(`{ascii lemmas} : ${ftsQuote(a)}`);
              if (p.length >= 3 && p !== a) alts.push(`phon : ${ftsQuote(p)}`);
            }
            if (t.length >= 3) alts.push(`meanings : ${ftsQuote(t.toLowerCase())}`);
            if (a.length >= 3 && a !== t.toLowerCase()) alts.push(`meanings : ${ftsQuote(a)}`);
          }
          if (alts.length) parts.push(`(${alts.join(" OR ")})`);
        }
        if (parts.length) {
          const match = parts.join(" AND ");
          const rows = await db.getAllAsync(
            `SELECT v.id, v.chapter, v.verse, v.lines_json, v.iast_lines_json, bm25(verse_fts, 4.0, 2.0, 3.0, 1.0, 1.5, 1.0) AS score
               FROM verse_fts JOIN verses v ON v.id = verse_fts.rowid
              WHERE verse_fts MATCH ?${chapterFilter}
              ORDER BY score LIMIT ? OFFSET ?`,
            [match, ...chapterParam, limit, offset]
          );
          for (const r of rows) {
            const lines = parse(r.lines_json, []);
            const iast = parse(r.iast_lines_json, []);
            const text = queryType === "devanagari" ? lines.join("\n") : iast.join("\n");
            const sn = makeSnippet(text, toks, 400);
            res.results.push({
              kind: "verse",
              verseId: r.id,
              chapter: r.chapter,
              verse: r.verse,
              snippet: sn.matches.length ? sn.snippet : text,
              matches: sn.matches,
              lines,
              iastLines: iast,
              score: r.score,
            });
          }
        }
      }

      // ---- translations / commentaries (word index, diacritic-insensitive, prefix)
      if (scope === "all" || scope === "translations" || scope === "commentaries") {
        // spelling variants for ASCII-typed Sanskrit words: 'kurukshetra' also finds 'kuruksetra'/'kurukṣetra'
        const variants = (t) => {
          const out = new Set([t]);
          if (/^[a-z]+$/i.test(t)) {
            const l = t.toLowerCase();
            const rules = [[/sh/g, "s"], [/ch/g, "c"], [/ee/g, "i"], [/oo/g, "u"], [/aa/g, "a"], [/ri/g, "r"], [/w/g, "v"]];
            let all = l;
            for (const [re, rep] of rules) {
              if (re.test(l)) out.add(l.replace(re, rep));
              all = all.replace(re, rep);
            }
            out.add(all);
          }
          return [...out];
        };
        const match = toks
          .map((t) => {
            const vs = variants(t).map((x) => `${ftsQuote(x)}*`);
            return vs.length > 1 ? `(${vs.join(" OR ")})` : vs[0];
          })
          .join(" AND ");
        const where = ["text_fts MATCH ?", "t.placeholder = 0"];
        const params = [match];
        if (scope === "translations") where.push("t.type = 'translation'");
        if (scope === "commentaries") where.push("t.type = 'commentary'");
        if (authorIds && authorIds.length) {
          where.push(`t.author_id IN (${authorIds.map(() => "?").join(",")})`);
          params.push(...authorIds);
        }
        if (chapter) {
          where.push("v.chapter = ?");
          params.push(chapter);
        }
        const rows = await db.getAllAsync(
          `SELECT t.id, t.verse_id, t.author_id, t.type, t.lang, t.body, v.chapter, v.verse, bm25(text_fts) AS score
             FROM text_fts JOIN texts t ON t.id = text_fts.rowid JOIN verses v ON v.id = t.verse_id
            WHERE ${where.join(" AND ")}
            ORDER BY score LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        const authors = await authorsById();
        for (const r of rows) {
          const plain = blocksToPlain(parse(r.body, []));
          const sn = makeSnippet(plain, toks);
          res.results.push({
            kind: r.type,
            textId: r.id,
            verseId: r.verse_id,
            chapter: r.chapter,
            verse: r.verse,
            authorId: r.author_id,
            authorName: authors.get(r.author_id)?.name,
            lang: r.lang,
            snippet: sn.snippet,
            matches: sn.matches,
            score: r.score,
          });
        }
      }
      return res;
    },
  };
  return api;
}
