import { authorName, authorSchool, readingMinutes } from "./names";

/** The reader's preferred translation for a verse, falling back sensibly when that author skipped it. */
export function pickTranslation(texts, primaryId) {
  if (!texts || !texts.length) return null;
  return texts.find((t) => t.authorId === primaryId) || texts.find((t) => t.lang === "english") || texts[0];
}

/** Translations in the reader's chosen order, hidden ones removed. */
export function orderTranslations(texts, { primaryId, order = [], hidden = [] }) {
  const rank = (t) => {
    if (t.authorId === primaryId) return -1;
    const i = order.indexOf(t.authorId);
    return i >= 0 ? i : 100 + t.authorId;
  };
  return (texts || []).filter((t) => !hidden.includes(t.authorId)).sort((a, b) => rank(a) - rank(b));
}

/** Commentaries with pinned commentators first (in pin order), then by tradition. */
export function orderCommentaries(texts, pinned = []) {
  const rank = (t) => {
    const i = pinned.indexOf(t.authorId);
    return i >= 0 ? i : 100 + t.authorId;
  };
  return (texts || []).slice().sort((a, b) => rank(a) - rank(b));
}

export function describeText(t) {
  return {
    name: authorName(t.authorId, t.authorName, t.type),
    school: authorSchool(t.authorId),
    minutes: readingMinutes(t.wordCount, t.lang),
  };
}

const NOTE_MARK = /⁽\d+⁾/g;

/** First words of a body, for previews. */
export function previewOf(blocks, max = 140) {
  const b = (blocks || []).find((x) => x.type === "paragraph") || (blocks || []).find((x) => x.type !== "footnotes");
  if (!b) return "";
  const s = (b.type === "verse_quote" ? b.lines.join(" ") : b.text).replace(/[⟦⟧]/g, "").replace(NOTE_MARK, "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max).replace(/\s+\S*$/, "") + "…" : s;
}

/** Plain text of blocks, for copy/share. Footnote markers become [n]; the notes follow. */
export function plainText(blocks) {
  return (blocks || [])
    .map((b) => {
      if (b.type === "footnotes") return b.items.map((f) => `[${f.n}] ${f.text}`).join("\n");
      return b.type === "verse_quote" ? b.lines.join("\n") : (b.label ? `${b.label} — ` : "") + b.text;
    })
    .join("\n\n")
    .replace(/[⟦⟧]/g, "")
    .replace(/⁽(\d+)⁾/g, "[$1]");
}
