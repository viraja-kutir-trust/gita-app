import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Chip, ChipRow, Empty, Icon, SearchField, T } from "../../../ui/components";
import { countMatches } from "../../../ui/reading";
import { fonts, useTheme } from "../../../ui/theme";
import { useTexts, useVerse } from "../../../data/gita";
import { LANGS, SCHOOLS, langLabel } from "../../../lib/names";
import { describeText, orderCommentaries, previewOf } from "../../../lib/texts";
import { togglePinnedCommentator } from "../../../state/store";

export default function Commentaries() {
  const params = useLocalSearchParams();
  const chapter = Number(params.chapter);
  const v = Number(params.verse);
  const router = useRouter();
  const dispatch = useDispatch();
  const { c } = useTheme();
  const pinned = useSelector((s) => s.settings.pinnedCommentators);
  const { data: verse } = useVerse(chapter, v);
  const { data: texts } = useTexts(verse?.id, "commentary");
  const [q, setQ] = useState("");
  const [school, setSchool] = useState("All");
  const [lang, setLang] = useState("any");

  const headerOptions = useMemo(() => ({ title: "Commentaries", headerTitle: () => <Title chapter={chapter} v={v} /> }), [chapter, v]);
  const langs = useMemo(() => [...new Set((texts || []).map((t) => t.lang))], [texts]);
  const terms = useMemo(() => q.trim().split(/\s+/).filter((t) => t.length >= 2), [q]);
  const rows = useMemo(() => {
    const ordered = orderCommentaries(texts, pinned);
    return ordered
      .map((t) => {
        const d = describeText(t);
        const nameHit = !terms.length || terms.every((x) => d.name.toLowerCase().includes(x.toLowerCase()));
        const hits = terms.length ? countMatches(t.blocks, terms) : 0;
        return { t, d, hits, nameHit };
      })
      .filter(({ t, d, hits, nameHit }) => (school === "All" || d.school === school) && (lang === "any" || t.lang === lang) && (!terms.length || nameHit || hits > 0))
      .sort((a, b) => (terms.length ? b.hits - a.hits : 0));
  }, [texts, pinned, terms, school, lang]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={headerOptions} />
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.t.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingTop: 12, paddingBottom: 12 }}>
            <SearchField value={q} onChangeText={setQ} placeholder="Search names or inside the text" style={{ marginHorizontal: 16 }} />
            <ChipRow>
              {SCHOOLS.map((s) => (
                <Chip key={s} label={s} selected={school === s} onPress={() => setSchool(s)} />
              ))}
            </ChipRow>
            {langs.length > 1 ? (
              <ChipRow>
                <Chip label="Any language" selected={lang === "any"} onPress={() => setLang("any")} />
                {langs.map((l) => (
                  <Chip key={l} label={LANGS[l]?.label || l} selected={lang === l} onPress={() => setLang(l)} />
                ))}
              </ChipRow>
            ) : null}
            <T v="footnote" muted style={{ paddingHorizontal: 20 }}>
              {terms.length
                ? `${rows.length} of ${texts?.length || 0} mention “${q.trim()}”`
                : `${rows.length} of ${texts?.length || 0} · pinned commentators stay on top`}
            </T>
          </View>
        }
        ListEmptyComponent={texts ? <Empty title="No commentary matches" body="Try another word, or clear the filters." icon="search" /> : null}
        renderItem={({ item: { t, d, hits } }) => {
          const isPinned = pinned.includes(t.authorId);
          return (
            <Pressable
              onPress={() => router.push({ pathname: `/commentary/${chapter}/${v}/${t.authorId}`, params: terms.length ? { q: q.trim() } : {} })}
              accessibilityRole="button"
              accessibilityLabel={`${d.name}, ${d.school}, ${langLabel(t.lang)}`}
              style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.surface2 : c.surface }]}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <T v="calloutStrong" numberOfLines={1}>
                  {d.name}
                </T>
                <T v="footnote" muted numberOfLines={1}>
                  {d.school} · {langLabel(t.lang)} · {d.minutes} min read
                  {hits ? ` · ${hits} match${hits > 1 ? "es" : ""}` : ""}
                </T>
                <T numberOfLines={2} style={{ fontFamily: t.lang === "english" ? fonts.serif : fonts.sanskrit, fontSize: 14, lineHeight: 22, color: c.ink2, marginTop: 2 }}>
                  {previewOf(t.blocks, 160)}
                </T>
              </View>
              <Pressable
                onPress={() => dispatch(togglePinnedCommentator(t.authorId))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isPinned ? `Unpin ${d.name}` : `Pin ${d.name} to the top`}
                style={styles.pin}
              >
                <Icon name={isPinned ? "pinFill" : "pin"} size={18} color={isPinned ? c.accent : c.muted} />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function Title({ chapter, v }) {
  return (
    <View style={{ alignItems: "center" }}>
      <T v="headline">Commentaries</T>
      <T v="caption" muted>
        on {chapter}.{v}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  pin: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
