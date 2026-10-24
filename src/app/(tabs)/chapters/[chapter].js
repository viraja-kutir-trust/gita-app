import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { Button, Card, Icon, ProgressBar, T } from "../../../ui/components";
import { Blocks } from "../../../ui/reading";
import { fonts, useTheme, UI } from "../../../ui/theme";
import { useChapterVerses, useQuery } from "../../../data/gita";
import { CHAPTERS, VERSE_COUNTS } from "../../../lib/names";
import { useProgress } from "../../../lib/progress";
import { scriptFont, toScript } from "../../../lib/script";

export default function ChapterDetail() {
  const { chapter } = useLocalSearchParams();
  const n = Number(chapter);
  const router = useRouter();
  const { c } = useTheme();
  const script = useSelector((s) => s.settings.script);
  const bookmarks = useSelector((s) => s.library.bookmarks);
  const notes = useSelector((s) => s.library.notes);
  const progress = useProgress();
  const { data: verses } = useChapterVerses(n);
  const { data: info } = useQuery(`chapter:${n}`, (g) => g.getChapter(n));
  const [showSummary, setShowSummary] = useState(false);
  const meta = CHAPTERS[n];
  const readCount = progress.perChapter[n];
  const next = progress.nextUnread(n);
  const remaining = VERSE_COUNTS[n] - readCount;
  const headerOptions = useMemo(() => ({ title: `Chapter ${n}`, headerLargeTitle: false }), [n]);

  const header = (
    <View style={{ gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <T style={{ fontFamily: fonts.sanskrit, fontSize: 19, color: c.accent }} numberOfLines={1}>
          {toScript(`${meta.ordinal} · ${meta.sa}`, script === "ro" ? "dv" : script)}
        </T>
        <T v="largeTitle" style={{ fontSize: 30, lineHeight: 36 }}>
          {meta.name}
        </T>
        <T v="callout" muted>
          {meta.en} · {VERSE_COUNTS[n]} verses
        </T>
      </View>

      {info?.summaryEnBlocks?.length ? (
        <Pressable onPress={() => setShowSummary((s) => !s)} accessibilityRole="button" accessibilityLabel={showSummary ? "Hide chapter summary" : "Show chapter summary"}>
          <View style={{ paddingHorizontal: 4, gap: 6 }}>
            {showSummary ? (
              <Blocks blocks={info.summaryEnBlocks} lang="english" size={15} />
            ) : (
              <T v="callout" color={c.ink2} numberOfLines={3}>
                {info.summaryEn}
              </T>
            )}
            <T v="footnoteStrong" accent>
              {showSummary ? "Show less" : "Read the chapter summary"}
            </T>
          </View>
        </Pressable>
      ) : null}

      <Card style={{ gap: 8, padding: 14, borderRadius: 18 }}>
        <View style={styles.between}>
          <T v="subheadStrong">
            {readCount} of {VERSE_COUNTS[n]} read
          </T>
          <T v="subhead" muted>
            {remaining ? `About ${Math.max(1, Math.round(remaining * 0.3))} min left` : "Completed"}
          </T>
        </View>
        <ProgressBar value={readCount / VERSE_COUNTS[n]} label={`Chapter ${n} progress`} />
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          title={readCount ? `Continue at ${n}.${next.verse}` : "Start reading"}
          onPress={() => router.push(`/verse/${n}/${next.verse}`)}
          style={{ flex: 1 }}
        />
        <Button title="Chant chapter" icon="chant" kind="secondary" onPress={() => router.push(`/chant?chapter=${n}`)} style={{ flex: 1, backgroundColor: c.surface }} />
      </View>
    </View>
  );

  const renderItem = ({ item: v, index }) => {
    const key = `${n}.${v.verse}`;
    const read = !!progress.read[key];
    const upNext = v.verse === next.verse && readCount > 0 && !read;
    const first = v.lines[0] ? toScript(v.lines[0], script === "ro" ? "dv" : script) : "";
    const firstRo = v.iastLines[0];
    return (
      <Pressable
        onPress={() => router.push(`/verse/${n}/${v.verse}`)}
        accessibilityRole="button"
        accessibilityLabel={`Verse ${n}.${v.verse}${read ? ", read" : ""}${bookmarks[key] ? ", bookmarked" : ""}`}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? c.surface2 : upNext ? c.accentSoft : c.surface },
          index === 0 && styles.firstRow,
          index === verses.length - 1 && styles.lastRow,
          index < verses.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
        ]}
      >
        <T v="footnoteStrong" color={upNext ? c.accent : c.muted} style={{ width: 40 }}>
          {n}.{v.verse}
        </T>
        <T numberOfLines={1} style={{ flex: 1, fontFamily: script === "ro" ? fonts.sanskritItalic : scriptFont(script), fontSize: 16, lineHeight: 26, color: c.ink }}>
          {script === "ro" ? firstRo : first}
        </T>
        {notes[key] ? <Icon name="note" size={15} color={c.muted} /> : null}
        {bookmarks[key] ? <Icon name="bookmarkFill" size={14} color={c.accent} /> : null}
        {upNext ? (
          <T v="caption" accent style={{ ...UI.semibold }}>
            Up next
          </T>
        ) : read ? (
          <Icon name="check" size={16} color={c.success} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <FlatList
        data={verses || []}
        keyExtractor={(v) => String(v.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ paddingBottom: 40 }}
        initialNumToRender={24}
      />
    </>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, minHeight: 50 },
  firstRow: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  lastRow: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
});
