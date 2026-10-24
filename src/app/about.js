import { Linking, StyleSheet, View } from "react-native";
import Screen from "../ui/Screen";
import { Card, ListRow, T } from "../ui/components";
import { useAuthors, useQuery } from "../data/gita";
import { authorName, langLabel } from "../lib/names";

export default function About() {
  const { data: sources } = useQuery("sources", (g) => g.getSources());
  const { data: authors } = useAuthors();
  return (
    <Screen contentStyle={{ gap: 16, padding: 16 }}>
      <T v="callout" muted>
        Gita All-In-One is free, has no ads and exists for learning. Every text below is credited to its author and source.
      </T>

      <T v="footnoteStrong" muted style={styles.h}>
        Translations and commentaries
      </T>
      <Card style={styles.list}>
        {(authors || []).map((a, i, arr) => (
          <ListRow
            key={a.id}
            last={i === arr.length - 1}
            title={authorName(a.id, a.name)}
            subtitle={[a.work, langLabel(a.lang), a.tradition, a.license].filter(Boolean).join(" · ")}
            subtitleLines={3}
            onPress={a.sourceUrl ? () => Linking.openURL(a.sourceUrl) : undefined}
          />
        ))}
      </Card>

      <T v="footnoteStrong" muted style={styles.h}>
        Texts, data and audio
      </T>
      <Card style={styles.list}>
        {(sources || [])
          .filter((s) => s.id !== "andhra-intro")
          .map((s, i, arr) => (
            <ListRow
              key={s.id}
              last={i === arr.length - 1}
              title={s.name}
              subtitle={[s.license, s.attribution].filter(Boolean).join(" · ")}
              subtitleLines={4}
              onPress={s.url ? () => Linking.openURL(s.url) : undefined}
            />
          ))}
      </Card>
      <View style={{ height: 20 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { paddingHorizontal: 4 },
  list: { padding: 0, overflow: "hidden" },
});
