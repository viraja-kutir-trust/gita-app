// Swami Nirvikalpananda's study material (Telugu): padaccheda and word-by-word.
// Same rules as the phone app's ui/study.js.

export const NOTE = /⁽(\d+)⁾/g;

/** The blocks of the units that hold this verse's padaccheda. */
export function padacchedaParts(units, verseNo) {
  return (units || []).flatMap((u) => (u.blocks || []).filter((b) => (b.verses || []).includes(verseNo) && b.padaccheda).map((b) => ({ u, b })));
}

// "యథా, ఆకాశ స్థితః, …" → words and the punctuation between them.
const PAD_SEP = /(\s*[,.;–]\s*)/;
export const splitPadaccheda = (text) =>
  (text || "")
    .split(PAD_SEP)
    .filter(Boolean)
    .map((t) => ({ text: t, sep: /^\s*[,.;–]\s*$/.test(t) }));

/** The padaccheda's words for a verse, in order (what each click index refers to). */
export function padacchedaItems(units, verseNo) {
  return padacchedaParts(units, verseNo).flatMap(({ b }) => splitPadaccheda(b.padaccheda).filter((x) => !x.sep).map((x) => x.text));
}

export function groupCaption(chapter, unit, verseNo) {
  const vs = unit?.verses || [];
  if (vs.length < 2) return null;
  return `Verses ${chapter}.${vs[0]}–${vs[vs.length - 1]} are explained together in this book`;
}
