import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import FootnoteSheet from "./FootnoteSheet";
import { T } from "./components";
import { fonts, useTheme, UI } from "./theme";
import { fromTelugu, scriptFont } from "../lib/script";

// Swami Nirvikalpananda's book is in Telugu: the Sanskrit parts (padaccheda, the
// words glossed) follow the reader's verse script, the Telugu meanings stay in
// Telugu unless the reader asks for them in their script too.
const TELUGU_FONT = "NotoSerifTelugu_400Regular";
const NOTE = /⁽(\d+)⁾/g;

/** Font for Telugu-language text shown in `key` ("te" = as printed). */
export function teluguFont(key) {
  return !key || key === "te" ? TELUGU_FONT : scriptFont(key);
}

/** Text with ⁽n⁾ markers → children with tappable note numbers. */
export function withNotes(text, conv, onNote, c, size) {
  const out = [];
  let at = 0;
  for (const m of (text || "").matchAll(NOTE)) {
    if (m.index > at) out.push(conv(text.slice(at, m.index)));
    const n = Number(m[1]);
    out.push(
      <Text
        key={`n${m.index}`}
        onPress={onNote ? () => onNote(n) : undefined}
        accessibilityRole="button"
        accessibilityLabel={`Footnote ${n}`}
        style={{ ...UI.semibold, fontSize: Math.round(size * 0.8), color: c.accent, backgroundColor: c.accentSoft }}
      >
        {`\u2002${n}\u2002`}
      </Text>
    );
    at = m.index + m[0].length;
  }
  if (at < (text || "").length) out.push(conv(text.slice(at)));
  return out;
}

/** Note sheet state for one unit's footnotes. */
function useNotes(notes) {
  const [open, setOpen] = useState(null);
  const byNumber = (n) => {
    const k = (notes || []).findIndex((f) => f.n === n);
    if (k >= 0) setOpen(k);
  };
  return { open, setOpen, byNumber };
}

function groupCaption(chapter, unit, verseNo) {
  const vs = unit.verses || [];
  if (vs.length < 2) return null;
  return `Verses ${chapter}.${vs[0]}–${vs[vs.length - 1]} are read together in this book`;
}

/**
 * Padaccheda (పదచ్ఛేదః): the verse with its words separated, as printed by Swami
 * Nirvikalpananda, in the reader's script. Only the blocks of this verse are shown
 * when the book prints several verses together.
 */
function padacchedaParts(units, verseNo) {
  return (units || []).flatMap((u) => (u.blocks || []).filter((b) => (b.verses || []).includes(verseNo) && b.padaccheda).map((b) => ({ u, b })));
}

// "యథా, ఆకాశ స్థితః, …" → words and the punctuation between them (mostly commas;
// a few passages also use "." ";" or "–").
const PAD_SEP = /(\s*[,.;–]\s*)/;
const splitPadaccheda = (text) =>
  (text || "")
    .split(PAD_SEP)
    .filter(Boolean)
    .map((t) => ({ text: t, sep: /^\s*[,.;–]\s*$/.test(t) }));

/** The padaccheda's words for a verse, in order: what each tap index refers to. */
export function padacchedaItems(units, verseNo) {
  return padacchedaParts(units, verseNo).flatMap(({ b }) => splitPadaccheda(b.padaccheda).filter((x) => !x.sep).map((x) => x.text));
}

export function Padaccheda({ units, chapter, verseNo, script, size = 17, onWordPress }) {
  const { c } = useTheme();
  const conv = (t) => fromTelugu(t, script === "dv" ? "dv" : script);
  const font = scriptFont(script);
  const parts = padacchedaParts(units, verseNo);
  const [open, setOpen] = useState(null);
  if (!parts.length) return null;
  const notes = parts[0].u.footnotes || [];
  // The book sometimes prints half a verse with its neighbour (1.20–21, 1.26–31):
  // its padaccheda then covers more than this verse.
  const covered = [...new Set(parts.flatMap(({ b }) => b.verses || []))].sort((a, b) => a - b);
  const split = covered.length > 1;
  const onNote = (n) => setOpen(notes.findIndex((f) => f.n === n));
  let wordNo = -1;
  return (
    <View style={{ gap: 6 }}>
      {parts.map(({ b }, i) => (
        <Text key={i} style={{ fontFamily: font, fontSize: size, lineHeight: Math.round(size * 1.75), color: c.ink }}>
          {splitPadaccheda(b.padaccheda).map((x, k) => {
            if (x.sep || !onWordPress) return <Text key={k}>{withNotes(x.text, conv, onNote, c, size)}</Text>;
            const my = ++wordNo;
            return (
              <Text key={k} onPress={() => onWordPress(my)} suppressHighlighting={false} accessibilityRole="button">
                {withNotes(x.text, conv, onNote, c, size)}
              </Text>
            );
          })}
        </Text>
      ))}
      {split ? (
        <T v="caption" muted>
          {parts.length > 1
            ? `The book prints this verse in two passages (with ${chapter}.${covered.filter((x) => x !== verseNo).join(", ")}); both are shown.`
            : `In the book this passage covers verses ${chapter}.${covered[0]}–${covered[covered.length - 1]}.`}
        </T>
      ) : null}
      <FootnoteSheet notes={notes} index={open != null && open >= 0 ? open : null} onIndex={setOpen} onClose={() => setOpen(null)} fontFamily={TELUGU_FONT} size={size} />
    </View>
  );
}

/**
 * Word-by-word meanings in Telugu (Swami Nirvikalpananda), in the book's order.
 * Terms follow the verse script; meanings are Telugu or transliterated.
 */
export function TeluguWords({ meanings, units, chapter, verseNo, script, teluguScript = "te", size = 15, onWordPress, meaningFont }) {
  const { c } = useTheme();
  const [sheet, setSheet] = useState(null); // {unit, index}
  const termConv = (t) => fromTelugu(t, script);
  const meanConv = (t) => fromTelugu(t, teluguScript);
  const caption = units?.[0] ? groupCaption(chapter, units[0], verseNo) : null;
  const open = (ui, n) => {
    const k = (units?.[ui]?.footnotes || []).findIndex((f) => f.n === n);
    if (k >= 0) setSheet({ unit: ui, index: k });
  };
  return (
    <View style={{ gap: 6 }}>
      {caption ? (
        <T v="caption" muted>
          {caption}
        </T>
      ) : null}
      <View style={{ gap: 4 }}>
        {(meanings || []).map((m, k) => (
          <Text key={k} style={styles.row} onPress={onWordPress ? () => onWordPress(k) : undefined} accessibilityRole={onWordPress ? "button" : undefined}>
            <Text style={{ fontFamily: scriptFont(script), fontSize: size, lineHeight: Math.round(size * 1.7), color: c.accent }}>
              {m.implied ? "(" : ""}
              {termConv(m.termTe)}
              {m.implied ? ")" : ""}
            </Text>
            {(m.notes || []).length ? withNotes(m.notes.map((n) => `⁽${n}⁾`).join(""), (t) => t, (n) => open(m.unit, n), c, size) : null}
            <Text style={{ fontFamily: meaningFont || teluguFont(teluguScript), fontSize: size, lineHeight: Math.round(size * 1.7), color: c.ink2 }}>
              {"  =  "}
              {withNotes(m.meaning, meanConv, (n) => open(m.unit, n), c, size)}
            </Text>
          </Text>
        ))}
      </View>
      {sheet ? (
        <FootnoteSheet
          notes={units?.[sheet.unit]?.footnotes || []}
          index={sheet.index}
          onIndex={(i) => setSheet({ ...sheet, index: i })}
          onClose={() => setSheet(null)}
          fontFamily={teluguFont(teluguScript)}
          size={size + 2}
          render={meanConv}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { ...UI.regular, fontFamily: fonts.serif },
});
