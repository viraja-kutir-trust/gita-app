import { memo, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { fonts, useTheme, UI } from "./theme";
import { T } from "./components";
import { fromTelugu, scriptDigits, scriptFont, toScript } from "../lib/script";
import FootnoteSheet from "./FootnoteSheet";

// ---------------------------------------------------------------- sloka
const PUNCT = /^[।॥|]+$/;

/** Split verse display lines into tappable word tokens (punctuation stays attached as plain text). */
export function lineTokens(line) {
  // Split on ordinary spaces only: non-breaking spaces glue "॥ n ॥" to the last word.
  return line.split(/[ \t\n]+/).filter(Boolean);
}

function withVerseNumber(line, n, script) {
  const num = scriptDigits(n, script);
  // Non-breaking spaces keep "॥ ४७ ॥" with the last word; the word joiner stops the
  // break Unicode otherwise allows after a danda.
  return line.replace(/[\s।॥|]+$/, "") + `\u00A0॥\u2060\u00A0${num}\u00A0॥`;
}

/**
 * The sloka, laid out by its metre (2 lines for anuṣṭubh, 4 for triṣṭubh),
 * speaker label separate, verse number in the chosen script's digits.
 */
export const Sloka = memo(function Sloka({
  verse,
  script = "dv",
  size = 23,
  showIast = true,
  onWordPress,
  activeToken,
  color,
  dimColor,
  align = "center",
  showNumber = true,
  iastSize,
}) {
  const { c } = useTheme();
  const ink = color || c.ink;
  const lines = useMemo(() => {
    if (!verse) return [];
    const src = script === "ro" ? verse.iastLines.map((l) => l.replace(/\|\|/g, "॥").replace(/\|/g, "।")) : verse.lines.map((l) => toScript(l, script));
    return src.map((l, i) => (showNumber && i === src.length - 1 ? withVerseNumber(l, verse.verse, script) : l));
  }, [verse, script, showNumber]);
  if (!verse) return null;
  const font = scriptFont(script);
  const speaker = verse.speaker ? (script === "ro" ? verse.speakerIast || verse.speaker : toScript(verse.speaker, script)) : null;
  const speakerAt = verse.speaker ? verse.speakerPosition || 0 : -1;
  const lineH = Math.round(size * 1.75);
  let tokenIndex = -1;

  const speakerLabel = (key) => (
    <Text key={key} style={[styles.speaker, { fontFamily: font, color: c.accent, fontSize: Math.round(size * 0.66) }]} accessibilityRole="header">
      {speaker}
    </Text>
  );

  const rendered = [];
  lines.forEach((line, li) => {
    // speaker_position counts padas; lines are half-verses (2 padas) for anuṣṭubh
    const padaIdx = verse.meter === "anushtubh" ? li * 2 : li;
    if (speakerAt === padaIdx) rendered.push(speakerLabel(`sp${li}`));
    const toks = lineTokens(line);
    rendered.push(
      <Text
        key={li}
        style={{ fontFamily: font, fontSize: size, lineHeight: lineH, color: ink, textAlign: align, alignSelf: "stretch" }}
        accessibilityLanguage="sa"
        // One printed line per half-verse/pāda: shrink a little rather than wrap mid-line.
        // At very large reading sizes, wrapping is better than tiny text.
        {...(size <= 27 ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.7 } : null)}
      >
        {toks.map((tok, ti) => {
          const isPunct = PUNCT.test(tok) || /^[०-९0-9౦-౯೦-೯൦-൯০-৯૦-૯]+$/.test(tok);
          const sep = ti < toks.length - 1 ? " " : "";
          if (isPunct || !onWordPress) return tok + sep;
          tokenIndex += 1;
          const my = tokenIndex;
          const on = activeToken === my;
          return (
            <Text key={ti}>
              <Text
                onPress={() => onWordPress(my)}
                suppressHighlighting={false}
                style={on ? { backgroundColor: c.accentSoft2, color: c.accentPressed } : undefined}
              >
                {tok}
              </Text>
              {sep}
            </Text>
          );
        })}
      </Text>
    );
  });

  return (
    <View style={{ alignItems: align === "center" ? "center" : "flex-start", gap: 2 }}>
      {rendered}
      {showIast && script !== "ro" ? (
        <View style={{ marginTop: 10, alignItems: align === "center" ? "center" : "flex-start" }}>
          {verse.iastLines.map((l, i) => (
            <Text
              key={i}
              style={{ fontFamily: fonts.sanskritItalic, fontSize: iastSize || Math.max(14, Math.round(size * 0.64)), lineHeight: Math.round((iastSize || size * 0.64) * 1.6), color: dimColor || c.muted, textAlign: align }}
            >
              {l.replace(/\s*\|\|\s*$/, "").replace(/\s*\|\s*$/, "")}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------- text blocks
const LANG_FONT = {
  sanskrit: fonts.sanskrit,
  hindi: fonts.sanskrit,
  english: fonts.serif,
  telugu: "NotoSerifTelugu_400Regular",
  tamil: "NotoSerifTamil_400Regular",
};

const DEVA_RUN = /[ऀ-ॿ꣠-ꣿ]+(?:[\s‌‍]+[ऀ-ॿ꣠-ꣿ]+)*/g;

export function convertDeva(text, script) {
  if (!script || script === "dv" || !text) return text;
  return text.replace(DEVA_RUN, (m) => toScript(m, script));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plain text of one block (what selections and highlights are measured against). */
export function blockPlain(b) {
  if (!b) return "";
  if (b.type === "footnotes") return "";
  const raw = b.type === "verse_quote" ? b.lines.join("\n") : b.text || "";
  return raw.replace(/[⟦⟧]/g, "").replace(NOTE_MARK, "");
}

const NOTE_MARK = /⁽(\d+)⁾/g;

/** Where a saved highlight sits in a block's plain text: [start, end] or null. */
export function locateHighlight(plain, h) {
  if (!h.quote) return [0, plain.length]; // older whole-paragraph highlights
  let from = 0;
  for (let k = 0; ; k++) {
    const at = plain.indexOf(h.quote, from);
    if (at < 0) return null;
    if (k === (h.occurrence || 0)) return [at, at + h.quote.length];
    from = at + 1;
  }
}

/**
 * Split a block into styled runs over its plain text: bold pratīkas (⟦…⟧),
 * search matches and saved highlights. Each run keeps its source offsets so a
 * selection in the displayed (possibly transliterated) text maps back exactly.
 */
function buildRuns(raw, { terms, counter, currentMatch, hlRanges }) {
  // Footnote markers ⁽n⁾ are not part of the text: note where they sit, then drop them.
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
  if (terms && terms.length) {
    const tre = new RegExp(terms.map(escapeRe).join("|"), "gi");
    let mm;
    while ((mm = tre.exec(plain))) {
      if (!mm[0]) {
        tre.lastIndex++;
        continue;
      }
      const idx = counter.n++;
      marks.push([mm.index, mm.index + mm[0].length, idx]);
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
    runs.push({ start: a, end: b, src: plain.slice(a, b), bold: !!inside(bold), mark: !!mk, current: mk ? mk[2] === currentMatch : false, hl: hl ? hl.color : null });
  }
  return { plain, runs, notes };
}

/** Display offset → plain-text offset, through script conversion. */
function toSourceOffset(runs, conv, labelLen, d) {
  let disp = labelLen;
  for (const r of runs) {
    const shown = conv(r.src);
    if (d <= disp + shown.length) {
      const into = d - disp;
      if (shown === r.src) return r.start + Math.min(into, r.src.length);
      // Converted run: find the shortest source prefix whose rendering covers `into` characters.
      let lo = 0;
      let hi = r.src.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (conv(r.src.slice(0, mid)).length >= into) hi = mid;
        else lo = mid + 1;
      }
      return r.start + lo;
    }
    disp += shown.length;
  }
  return runs.length ? runs[runs.length - 1].end : 0;
}

export function countMatches(blocks, terms) {
  if (!terms || !terms.length) return 0;
  const tre = new RegExp(terms.map(escapeRe).join("|"), "gi");
  let n = 0;
  for (const b of blocks || []) n += (blockPlain(b).match(tre) || []).length;
  return n;
}

function runStyle(r, c, hlColors) {
  return [
    r.bold && { ...UI.semibold },
    r.hl && { backgroundColor: hlColors[r.hl] || c.highlight },
    r.mark && { backgroundColor: r.current ? c.accent : c.mark, color: r.current ? c.onAccent : c.ink },
  ];
}

/**
 * One block of text. Plain <Text> when read-only; when `onSelect` is given it is
 * a read-only text field, the one React Native view that reports which
 * characters the reader selected, so partial highlights work without native code.
 * A paragraph with footnote markers stays plain <Text> so the numbers can be tapped.
 */
function BlockText({ label, runs, notes = [], onNote, style, conv, c, hlColors, onSelect, resetKey }) {
  const labelShown = label ? `${conv(label)} — ` : "";
  const size = style?.fontSize || 17;
  const marker = (n, key) => (
    <Text
      key={key}
      onPress={onNote ? () => onNote(n) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`Footnote ${n}`}
      style={{ ...UI.semibold, fontFamily: undefined, fontSize: Math.round(size * 0.8), color: c.accent, backgroundColor: c.accentSoft }}
    >
      {`\u2002${n}\u2002`}
    </Text>
  );
  const children = [
    labelShown ? (
      <Text key="l" style={{ ...UI.semibold }}>
        {labelShown}
      </Text>
    ) : null,
  ];
  runs.forEach((r, i) => {
    for (const [p, n] of notes) if (p === r.start && !runs.some((q) => q.end === p)) children.push(marker(n, `m${i}-${n}`));
    children.push(
      <Text key={i} style={runStyle(r, c, hlColors)}>
        {conv(r.src)}
      </Text>
    );
    for (const [p, n] of notes) if (p === r.end) children.push(marker(n, `m${i}-${n}`));
  });
  if (!runs.length) for (const [, n] of notes) children.push(marker(n, `m-${n}`));
  // Web: a <textarea> cannot hold styled children, so no partial selection there.
  if (!onSelect || notes.length || Platform.OS === "web") return <Text style={style}>{children}</Text>;
  return (
    <SelectableText
      key={resetKey}
      style={style}
      c={c}
      onSelection={(a, b) => {
        if (a === b) return onSelect(null);
        const s0 = toSourceOffset(runs, conv, labelShown.length, Math.max(a, labelShown.length));
        const s1 = toSourceOffset(runs, conv, labelShown.length, Math.max(b, labelShown.length));
        onSelect(s1 > s0 ? { start: s0, end: s1 } : null);
      }}
    >
      {children}
    </SelectableText>
  );
}

/** "Notes 1 2 3" under a passage; each number opens the note in a bottom sheet. */
function NotesRow({ items, onOpen, c, size }) {
  return (
    <View style={[styles.notesRow, { borderTopColor: c.line }]}>
      <T v="footnoteStrong" muted>
        {items.length === 1 ? "Footnote" : "Footnotes"}
      </T>
      {items.map((f, i) => (
        <Text
          key={f.n}
          onPress={() => onOpen(i)}
          accessibilityRole="button"
          accessibilityLabel={`Open footnote ${f.n}`}
          style={[styles.notePill, { ...UI.semibold, fontSize: Math.round(size * 0.8), color: c.accent, backgroundColor: c.accentSoft }]}
        >
          {f.n}
        </Text>
      ))}
    </View>
  );
}

function SelectableText({ children, style, onSelection, c }) {
  const [k, setK] = useState(0);
  return (
    <TextInput
      key={k}
      multiline
      scrollEnabled={false}
      // iOS keeps selection on a non-editable field; Android needs it "editable"
      // with the keyboard suppressed, and any typed change is discarded.
      editable={Platform.OS !== "ios"}
      showSoftInputOnFocus={false}
      caretHidden
      contextMenuHidden={false}
      selectionColor={c.accent + "55"}
      onChangeText={() => setK((x) => x + 1)}
      onSelectionChange={(e) => onSelection(e.nativeEvent.selection.start, e.nativeEvent.selection.end)}
      style={[style, { padding: 0, paddingTop: 0, paddingBottom: 0, margin: 0, textAlignVertical: "top" }]}
      accessibilityHint="Select words to highlight, copy or add to your note"
    >
      {children}
    </TextInput>
  );
}

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"];

export function highlightPalette(c) {
  return c.dark
    ? { yellow: "#5C4B12", green: "#1F4A2A", blue: "#233452", pink: "#5A2338" }
    : { yellow: "#FCE8A6", green: "#D4F0D0", blue: "#DCE6F7", pink: "#F9D6E3" };
}

/**
 * Renders a translation/commentary body (array of blocks) with proper
 * paragraphs, headings, quoted verses laid out like slokas, bold pratīkas,
 * search highlighting and saved highlights. With `onSelectText`, readers can
 * select any part of a paragraph; it reports {block, start, end, quote, occurrence}.
 */
export const Blocks = memo(function Blocks({
  blocks,
  lang,
  size = 17,
  script = "dv",
  terms,
  currentMatch = -1,
  onMatchBlock,
  onBlockLayout,
  highlights,
  onSelectText,
  resetKey = 0,
  teluguScript = "te",
  font,
}) {
  const { c } = useTheme();
  const [openNote, setOpenNote] = useState(null);
  const hlColors = highlightPalette(c);
  const teConv = lang === "telugu" && teluguScript !== "te";
  const conv = (t) => (teConv ? fromTelugu(t, teluguScript) : convertDeva(t, script));
  const noteItems = (blocks || []).filter((b) => b.type === "footnotes").flatMap((b) => b.items || []);
  const openByNumber = (n) => {
    const k = noteItems.findIndex((f) => f.n === n);
    if (k >= 0) setOpenNote(k);
  };
  const baseFont = font
    ? font
    : teConv
    ? scriptFont(teluguScript)
    : script !== "dv" && (lang === "sanskrit" || lang === "hindi")
      ? scriptFont(script)
      : LANG_FONT[lang] || fonts.serif;
  const lh = Math.round(size * (lang === "english" ? 1.6 : 1.75));
  const counter = { n: 0 };
  const items = (blocks || []).map((b, i) => {
    if (b.type === "footnotes") {
      return b.items?.length ? <NotesRow key={i} items={b.items} onOpen={setOpenNote} c={c} size={size} /> : null;
    }
    const start = counter.n;
    const raw = b.type === "verse_quote" ? b.lines.join("\n") : b.text || "";
    const plainForHl = raw.replace(/[⟦⟧]/g, "").replace(NOTE_MARK, "");
    const hlRanges = (highlights || [])
      .filter((h) => h.block === i)
      .map((h) => {
        const r = locateHighlight(plainForHl, h);
        return r ? { start: r[0], end: r[1], color: h.color || "blue" } : null;
      })
      .filter(Boolean);
    const { plain, runs, notes } = buildRuns(raw, { terms, counter, currentMatch, hlRanges });
    const select = onSelectText
      ? (sel) => {
          if (!sel) return onSelectText(null);
          const quote = plain.slice(sel.start, sel.end);
          let occurrence = 0;
          for (let at = plain.indexOf(quote); at >= 0 && at < sel.start; at = plain.indexOf(quote, at + 1)) occurrence++;
          onSelectText({ block: i, start: sel.start, end: sel.end, quote, occurrence: Math.max(0, occurrence) });
        }
      : undefined;
    let el;
    if (b.type === "heading") {
      el = <BlockText runs={runs} conv={conv} c={c} hlColors={hlColors} onSelect={select} resetKey={resetKey} style={{ ...UI.semibold, fontSize: Math.round(size * 0.95), lineHeight: lh, color: c.accent, marginTop: i ? 8 : 0 }} />;
    } else if (b.type === "verse_quote") {
      el = (
        <View style={[styles.quote, { backgroundColor: c.surface2 }]}>
          <BlockText runs={runs} conv={conv} c={c} hlColors={hlColors} onSelect={select} resetKey={resetKey} style={{ fontFamily: scriptFont(script), fontSize: size, lineHeight: lh, color: c.ink, textAlign: "center" }} />
          {b.ref ? (
            <T v="caption" muted style={{ textAlign: "center", marginTop: 4 }}>
              {b.ref}
            </T>
          ) : null}
        </View>
      );
    } else {
      el = (
        <BlockText
          label={b.label}
          runs={runs}
          notes={notes}
          onNote={openByNumber}
          conv={conv}
          c={c}
          hlColors={hlColors}
          onSelect={select}
          resetKey={resetKey}
          style={{ fontFamily: baseFont, fontSize: size, lineHeight: lh, color: c.ink }}
        />
      );
    }
    const hasCurrent = currentMatch >= start && currentMatch < counter.n;
    if (hasCurrent) onMatchBlock?.(i);
    return (
      <View key={i} onLayout={onBlockLayout ? (e) => onBlockLayout(i, e.nativeEvent.layout.y) : undefined}>
        {el}
      </View>
    );
  });
  return (
    <View style={{ gap: Math.round(size * 0.8) }}>
      {items}
      {noteItems.length ? (
        <FootnoteSheet notes={noteItems} index={openNote} onIndex={setOpenNote} onClose={() => setOpenNote(null)} fontFamily={baseFont} size={size} render={conv} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  speaker: { marginBottom: 4, textAlign: "center" },
  quote: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  notesRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  notePill: { minWidth: 30, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 13, overflow: "hidden", textAlign: "center" },
});
