import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import ActionMenu from "../../../ui/ActionMenu";
import { highlightPalette } from "../../../ui/reading";
import { removeHighlight } from "../../../state/store";
import Screen from "../../../ui/Screen";
import { Card, Empty, ListRow, Segmented, T } from "../../../ui/components";
import { fonts, useTheme, UI } from "../../../ui/theme";
import { useVerse } from "../../../data/gita";
import { CHAPTERS, parseVerseKey, VERSE_COUNTS } from "../../../lib/names";
import { useProgress } from "../../../lib/progress";
import { scriptFont, toScript } from "../../../lib/script";

const HEADER = { title: "Library" };

export default function Library() {
  const router = useRouter();
  const { c } = useTheme();
  const progress = useProgress();
  const bookmarks = useSelector((s) => s.library.bookmarks);
  const notes = useSelector((s) => s.library.notes);
  const highlights = useSelector((s) => s.library.highlights);
  const history = useSelector((s) => s.progress.history);
  const [tab, setTab] = useState("bookmarks");
  const [removing, setRemoving] = useState(null);
  const dispatch = useDispatch();
  const pal = highlightPalette(c);

  const bookmarkKeys = useMemo(() => Object.entries(bookmarks).sort((a, b) => b[1] - a[1]).map(([k]) => k), [bookmarks]);
  const noteKeys = useMemo(() => Object.entries(notes).sort((a, b) => b[1].updatedAt - a[1].updatedAt).map(([k]) => k), [notes]);
  const hl = useMemo(() => highlights.slice().sort((a, b) => b.createdAt - a.createdAt), [highlights]);
  const open = (k) => {
    const { chapter, verse } = parseVerseKey(k);
    router.push(`/verse/${chapter}/${verse}`);
  };

  return (
    <>
      <Stack.Screen options={HEADER} />
      <Screen contentStyle={{ gap: 16, paddingTop: 6 }}>
        <Card style={{ marginHorizontal: 16, gap: 14 }}>
          <View style={styles.between}>
            <View style={{ gap: 2 }}>
              <T v="eyebrow" muted>
                Reading progress
              </T>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <T style={{ ...UI.bold, fontSize: 30, lineHeight: 36, color: c.ink }}>{progress.total}</T>
                <T v="headline" muted style={{ ...UI.medium }}>
                  of 701 verses
                </T>
              </View>
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <T style={{ ...UI.bold, fontSize: 22, color: c.accent }}>
                {progress.streak} {progress.streak === 1 ? "day" : "days"}
              </T>
              <T v="caption" muted>
                reading streak
              </T>
            </View>
          </View>
          <View
            style={styles.bars}
            accessible
            accessibilityLabel={`Progress by chapter. ${progress.perChapter
              .slice(1)
              .map((n, i) => `Chapter ${i + 1}: ${n} of ${VERSE_COUNTS[i + 1]}`)
              .join(". ")}`}
          >
            {progress.perChapter.slice(1).map((n, i) => {
              const f = n / VERSE_COUNTS[i + 1];
              return (
                <View key={i} style={[styles.bar, { backgroundColor: c.surface3 }]}>
                  <View style={{ height: `${f * 100}%`, backgroundColor: c.accent, borderRadius: 4 }} />
                </View>
              );
            })}
          </View>
          <View style={styles.between}>
            {["Ch 1", "Ch 6", "Ch 12", "Ch 18"].map((l) => (
              <T key={l} v="caption" muted>
                {l}
              </T>
            ))}
          </View>
        </Card>

        <Segmented
          style={{ marginHorizontal: 16 }}
          value={tab}
          onChange={setTab}
          options={[
            { value: "bookmarks", label: `Bookmarks ${bookmarkKeys.length || ""}`.trim() },
            { value: "notes", label: `Notes ${noteKeys.length || ""}`.trim() },
            { value: "highlights", label: `Highlights ${hl.length || ""}`.trim() },
            { value: "history", label: "History" },
          ]}
        />

        <Card style={styles.list}>
          {tab === "bookmarks" &&
            (bookmarkKeys.length ? (
              bookmarkKeys.map((k, i) => <VerseRow key={k} k={k} last={i === bookmarkKeys.length - 1} onPress={() => open(k)} />)
            ) : (
              <Empty title="No bookmarks yet" body="Tap the bookmark on any verse to keep it here." icon="bookmark" />
            ))}
          {tab === "notes" &&
            (noteKeys.length ? (
              noteKeys.map((k, i) => <VerseRow key={k} k={k} last={i === noteKeys.length - 1} onPress={() => open(k)} subtitle={notes[k].text} />)
            ) : (
              <Empty title="No notes yet" body="Add a reflection from any verse page." icon="note" />
            ))}
          {tab === "highlights" &&
            (hl.length ? (
              hl.map((h, i) => (
                <Pressable
                  key={h.id}
                  onPress={() => {
                    const { chapter, verse } = parseVerseKey(h.verseKey);
                    if (h.kind === "translation" || !h.authorId) router.push(`/verse/${chapter}/${verse}`);
                    else router.push(`/commentary/${chapter}/${verse}/${h.authorId}`);
                  }}
                  onLongPress={() => setRemoving(h)}
                  accessibilityRole="button"
                  accessibilityHint="Long press to remove"
                  style={({ pressed }) => [
                    styles.hlRow,
                    { backgroundColor: pressed ? c.surface2 : "transparent" },
                    i < hl.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
                  ]}
                >
                  <View style={[styles.hlBar, { backgroundColor: pal[h.color] || c.highlight }]} />
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <T v="footnoteStrong" accent numberOfLines={1}>
                      {h.verseKey} · {h.author || "Commentary"}
                    </T>
                    <T numberOfLines={3} style={{ fontFamily: /[\u0900-\u097F]/.test(h.snippet || "") ? fonts.sanskrit : fonts.serif, fontSize: 15, lineHeight: 23, color: c.ink }}>
                      {h.snippet}
                    </T>
                  </View>
                </Pressable>
              ))
            ) : (
              <Empty title="No highlights yet" body="Select any words in a translation or commentary, then pick a colour." icon="highlight" />
            ))}
          {tab === "history" &&
            (history.length ? (
              history.slice(0, 40).map((k, i, a) => <VerseRow key={k} k={k} last={i === a.length - 1} onPress={() => open(k)} />)
            ) : (
              <Empty title="Nothing read yet" body="Verses you open appear here." icon="history" />
            ))}
        </Card>
      </Screen>
      <ActionMenu
        visible={!!removing}
        title={removing?.snippet?.slice(0, 120)}
        onClose={() => setRemoving(null)}
        items={[{ label: "Remove highlight", icon: "trash", destructive: true, onPress: () => dispatch(removeHighlight(removing.id)) }]}
      />
    </>
  );
}

function VerseRow({ k, onPress, last, subtitle }) {
  const { c } = useTheme();
  const script = useSelector((s) => s.settings.script);
  const { chapter, verse } = parseVerseKey(k);
  const { data: v } = useVerse(chapter, verse);
  const sc = script === "ro" ? "dv" : script;
  return (
    <ListRow
      last={last}
      onPress={onPress}
      accessibilityLabel={`Verse ${k}`}
      title={
        <T v="footnoteStrong" accent numberOfLines={1}>
          {k} · {CHAPTERS[chapter]?.name}
        </T>
      }
      subtitle={
        subtitle ? (
          <T v="subhead" color={c.ink2} numberOfLines={2}>
            {subtitle}
          </T>
        ) : (
          <T numberOfLines={1} style={{ fontFamily: scriptFont(sc), fontSize: 16, lineHeight: 26, color: c.ink }}>
            {v ? toScript(v.lines[0], sc) : " "}
          </T>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  bars: { flexDirection: "row", gap: 4, height: 64, alignItems: "flex-end" },
  bar: { flex: 1, height: 64, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  list: { marginHorizontal: 16, padding: 0, overflow: "hidden" },
  hlRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  hlBar: { width: 4, borderRadius: 2 },
});
