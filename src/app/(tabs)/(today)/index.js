import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import Screen from "../../../ui/Screen";
import { Button, Card, Icon, IconButton, ProgressBar, SectionTitle, T } from "../../../ui/components";
import { Blocks, Sloka } from "../../../ui/reading";
import { useTheme } from "../../../ui/theme";
import { useTexts, useVerse } from "../../../data/gita";
import { useRecitation } from "../../../audio/AudioProvider";
import { AUDIO_ENABLED } from "../../../lib/features";
import { CHAPTERS, VERSE_COUNTS } from "../../../lib/names";
import { useProgress, verseOfTheDay } from "../../../lib/progress";
import { pickTranslation } from "../../../lib/texts";

const DATE_FMT = { weekday: "long", day: "numeric", month: "long" };

export default function Today() {
  const router = useRouter();
  const { c } = useTheme();
  const settings = useSelector((s) => s.settings);
  const bookmarks = useSelector((s) => s.library.bookmarks);
  const progress = useProgress();
  const audio = useRecitation();
  const vod = useMemo(() => verseOfTheDay(), []);
  const { data: verse } = useVerse(vod.chapter, vod.verse);
  const { data: translations } = useTexts(verse?.id, "translation");
  const tr = pickTranslation(translations, settings.primaryTranslatorId);
  const next = progress.last ? progress.nextUnread() : { chapter: 1, verse: 1 };
  const chChapter = progress.last?.chapter || 12;
  const open = (ch, v) => router.push(`/verse/${ch}/${v}`);
  const headerOptions = useMemo(
    () => ({
      title: "Today",
      headerRight: () => <IconButton name="settings" label="Settings" onPress={() => router.push("/settings")} size={36} iconSize={19} />,
    }),
    [router]
  );

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <Screen contentStyle={{ gap: 14, paddingTop: 6 }}>
        <View style={[styles.rowBetween, { paddingHorizontal: 20 }]}>
          <T v="eyebrow" muted numberOfLines={1} style={{ flexShrink: 1 }}>
            {new Date().toLocaleDateString(undefined, DATE_FMT)}
          </T>
          <Pressable onPress={() => router.push("/settings")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Reading settings">
            <T v="footnoteStrong" accent>
              Reading settings
            </T>
          </Pressable>
        </View>

        <Card style={styles.hero}>
          <View style={styles.rowBetween}>
            <T v="eyebrow" accent numberOfLines={1}>
              Verse of the day
            </T>
            <T v="footnote" muted numberOfLines={1}>
              Chapter {vod.chapter} · Verse {vod.verse}
            </T>
          </View>
          {verse ? <Sloka verse={verse} script={settings.script} size={20 * settings.fontScale} showIast={false} /> : <View style={{ height: 80 }} />}
          {tr ? <Blocks blocks={tr.blocks} lang={tr.lang} size={15.5 * settings.fontScale} /> : null}
          <View style={styles.actions}>
            <Button title="Read with commentary" onPress={() => open(vod.chapter, vod.verse)} style={{ flex: 1 }} />
            {AUDIO_ENABLED ? (
            <IconButton
              name={audio.isCurrent(vod.chapter, vod.verse) && audio.playing ? "pause" : "play"}
              label="Play recitation"
              color={c.accent}
              style={[styles.round, { backgroundColor: c.accentSoft }]}
              onPress={() => (audio.isCurrent(vod.chapter, vod.verse) ? audio.toggle() : audio.play(vod.chapter, vod.verse, "single"))}
            />
            ) : null}
          </View>
        </Card>

        <Card onPress={() => open(next.chapter, next.verse)} style={{ marginHorizontal: 16, gap: 10 }} accessibilityLabel="Continue reading">
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="eyebrow" muted>
                {progress.last ? "Continue reading" : "Begin reading"}
              </T>
              <T v="headline" numberOfLines={1}>
                Chapter {next.chapter} · {CHAPTERS[next.chapter].name}
              </T>
              <T v="subhead" muted numberOfLines={1}>
                {progress.last ? `Next: verse ${next.verse} of ${VERSE_COUNTS[next.chapter]}` : "Start with Arjuna's question at Kurukṣetra"}
              </T>
            </View>
            <Icon name="chevronRight" size={16} color={c.muted} />
          </View>
          {progress.last ? <ProgressBar value={progress.chapterFraction(next.chapter)} label={`Chapter ${next.chapter} progress`} /> : null}
        </Card>

        <Card tone="inverse" onPress={() => router.push(`/chant?chapter=${chChapter}`)} style={[styles.chant]} accessibilityLabel="Start chanting">
          <View style={[styles.chantIcon, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
            <Icon name="chant" size={20} color="#F0A55B" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="calloutStrong" color="#FFFFFF" numberOfLines={1}>
              Chant Chapter {chChapter} · {CHAPTERS[chChapter].name}
            </T>
            <T v="footnote" color="#C7C7CC" numberOfLines={1}>
              {VERSE_COUNTS[chChapter]} verses · {AUDIO_ENABLED ? "continuous, with recitation" : "continuous reading"}
            </T>
          </View>
        </Card>

        <View style={[styles.stats]}>
          <Card style={styles.stat} onPress={() => router.navigate("/library")} accessibilityLabel="Reading progress">
            <T v="title">{progress.total}</T>
            <T v="footnote" muted numberOfLines={1}>
              verses read
            </T>
          </Card>
          <Card style={styles.stat} onPress={() => router.navigate("/library")} accessibilityLabel="Reading streak">
            <T v="title">{progress.streak}</T>
            <T v="footnote" muted numberOfLines={1}>
              day streak
            </T>
          </Card>
          <Card style={styles.stat} onPress={() => router.navigate("/library")} accessibilityLabel="Bookmarks">
            <T v="title">{Object.keys(bookmarks).length}</T>
            <T v="footnote" muted numberOfLines={1}>
              bookmarks
            </T>
          </Card>
        </View>

        <SectionTitle title="Chapters" action="See all" onAction={() => router.navigate("/chapters")} style={{ marginTop: 8 }} />
        <View style={styles.grid}>
          {[1, 2, 3, 12].map((n) => (
            <Card key={n} style={styles.tile} onPress={() => router.push(`/chapters/${n}`)} accessibilityLabel={`Chapter ${n}`}>
              <T style={{ fontFamily: "TiroDevanagariSanskrit_400Regular", fontSize: 22, color: c.accent }}>{toDeva(n)}</T>
              <T v="subheadStrong" numberOfLines={1}>
                {CHAPTERS[n].name}
              </T>
              <T v="caption" muted numberOfLines={1}>
                {VERSE_COUNTS[n]} verses · {Math.round(progress.chapterFraction(n) * 100)}%
              </T>
            </Card>
          ))}
        </View>
      </Screen>
    </>
  );
}

function toDeva(n) {
  return String(n).replace(/[0-9]/g, (d) => "०१२३४५६७८९"[Number(d)]);
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: 16, gap: 14 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 2 },
  round: { width: 46, height: 46, borderRadius: 23 },
  chant: { marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16 },
  chantIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  stat: { flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 12, gap: 2, borderRadius: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16 },
  tile: { width: "48.5%", flexGrow: 1, flexBasis: "45%", padding: 14, gap: 4, borderRadius: 18 },
});
