import { StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Screen from "../../../ui/Screen";
import { Card, ListRow, ProgressBar, T } from "../../../ui/components";
import { useTheme } from "../../../ui/theme";
import { CHAPTERS, VERSE_COUNTS } from "../../../lib/names";
import { useProgress } from "../../../lib/progress";

const HEADER = { title: "Chapters" };

export default function Chapters() {
  const router = useRouter();
  const { c } = useTheme();
  const progress = useProgress();
  return (
    <>
      <Stack.Screen options={HEADER} />
      <Screen contentStyle={{ paddingTop: 6, gap: 12 }}>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          <T v="subhead" muted>
            {progress.total} {progress.total === 1 ? "verse" : "verses"} read · {Math.round(progress.fraction * 100)}%
          </T>
          <ProgressBar value={progress.fraction} label="Whole Gita progress" />
        </View>
        <Card style={styles.list}>
          {CHAPTERS.slice(1).map((ch, i) => {
            const n = i + 1;
            const f = progress.chapterFraction(n);
            return (
              <ListRow
                key={n}
                last={n === 18}
                onPress={() => router.push(`/chapters/${n}`)}
                accessibilityLabel={`Chapter ${n}, ${ch.name}`}
                left={
                  <View style={[styles.num, { backgroundColor: f >= 1 ? c.accent : c.accentSoft }]}>
                    <T v="subheadStrong" color={f >= 1 ? c.onAccent : c.accent}>
                      {n}
                    </T>
                  </View>
                }
                title={ch.name}
                subtitle={
                  <View style={{ gap: 6 }}>
                    <T v="footnote" muted numberOfLines={1}>
                      {ch.en} · {VERSE_COUNTS[n]} verses
                    </T>
                    {f > 0 && f < 1 ? <ProgressBar value={f} height={4} label={`Chapter ${n} progress`} /> : null}
                  </View>
                }
              />
            );
          })}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: 16, padding: 0, overflow: "hidden" },
  num: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
