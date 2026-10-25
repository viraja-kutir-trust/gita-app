// Text blocks → styled runs. Same rules as the phone app's ui/reading.js:
// ⟦…⟧ marks a pratīka (bold), ⁽n⁾ a footnote, plus search matches and saved
// highlights. Runs keep their offsets in the block's plain text, so a selection
// in the displayed (possibly transliterated) text maps back exactly.

export const NOTE_MARK = /⁽(\d+)⁾/g;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Plain text of one block (what selections and highlights are measured against). */
export function blockPlain(b) {
  if (!b || b.type === "footnotes") return "";
  const raw = b.type === "verse_quote" ? b.lines.join("\n") : b.text || "";
  return raw.replace(/[⟦⟧]/g, "").replace(NOTE_MARK, "");
}

/** Where a saved highlight sits in a block's plain text: [start, end] or null. */
export function locateHighlight(plain, h) {
  if (!h.quote) return [0, plain.length];
  let from = 0;
  for (let k = 0; ; k++) {
    const at = plain.indexOf(h.quote, from);
    if (at < 0) return null;
    if (k === (h.occurrence || 0)) return [at, at + h.quote.length];
    from = at + 1;
  }
}

export function termsRegex(terms) {
  return terms && terms.length ? new RegExp(terms.map(escapeRe).join("|"), "gi") : null;
}

export function countMatches(blocks, terms) {
  const re = termsRegex(terms);
  if (!re) return 0;
  let n = 0;
  for (const b of blocks || []) n += (blockPlain(b).match(re) || []).length;
  return n;
}

export function buildRuns(raw, { terms, counter, currentMatch, hlRanges }) {
  const notes = [];
  if (raw.includes("⁽")) {
    let out = "";
    let at = 0;
    for (const m of raw.matchAll(NOTE_MARK)) {
      out += raw.slice(at, m.index);
      notes.push([out.replace(/[⟦⟧]/g, "").length, Number(m[1])]);
      at = m.index + m[0].length;
    }
    raw = out + raw.slice(at);
  }
  let plain = "";
  const bold = [];
  const re = /⟦([^⟧]*)⟧/g;
  let last = 0;
  let m;
  while ((m = re.exec(raw))) {
    plain += raw.slice(last, m.index);
    bold.push([plain.length, plain.length + m[1].length]);
    plain += m[1];
    last = m.index + m[0].length;
  }
  plain += raw.slice(last);

  const marks = [];
  const tre = termsRegex(terms);
  if (tre) {
    let mm;
    while ((mm = tre.exec(plain))) {
      if (!mm[0]) {
        tre.lastIndex++;
        continue;
      }
      marks.push([mm.index, mm.index + mm[0].length, counter.n++]);
    }
  }
  const edges = new Set([0, plain.length]);
  for (const [p] of notes) edges.add(p);
  for (const [a, b] of bold) edges.add(a).add(b);
  for (const [a, b] of marks) edges.add(a).add(b);
  for (const r of hlRanges || []) edges.add(r.start).add(r.end);
  const cuts = [...edges].filter((x) => x >= 0 && x <= plain.length).sort((a, b) => a - b);
  const runs = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const a = cuts[k];
    const b = cuts[k + 1];
    if (a === b) continue;
    const inside = (rs) => rs.find((r) => (r.start ?? r[0]) <= a && (r.end ?? r[1]) >= b);
    const mk = inside(marks);
    const hl = inside(hlRanges || []);
    runs.push({
      start: a,
      end: b,
      src: plain.slice(a, b),
      bold: !!inside(bold),
      mark: mk ? mk[2] : null,
      hl: hl ? hl.color : null,
      hlId: hl ? hl.id : null,
    });
  }
  return { plain, runs, notes };
}

/** Offset into a run's displayed (converted) text → offset into its source text. */
export function sourceOffset(run, conv, into) {
  const shown = conv(run.src);
  if (shown === run.src) return run.start + Math.min(into, run.src.length);
  let lo = 0;
  let hi = run.src.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (conv(run.src.slice(0, mid)).length >= into) hi = mid;
    else lo = mid + 1;
  }
  return run.start + lo;
}

/** Plain text of blocks, for copy/share. Footnote markers become [n]; the notes follow. */
export function plainText(blocks) {
  return (blocks || [])
    .map((b) => {
      if (b.type === "footnotes") return (b.items || []).map((f) => `[${f.n}] ${f.text}`).join("\n");
      return b.type === "verse_quote" ? b.lines.join("\n") : (b.label ? `${b.label} — ` : "") + b.text;
    })
    .join("\n\n")
    .replace(/[⟦⟧]/g, "")
    .replace(/⁽(\d+)⁾/g, "[$1]");
}
