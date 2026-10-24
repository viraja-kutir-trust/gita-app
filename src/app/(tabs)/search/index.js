import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Button, Card, Chip, ChipRow, Empty, Icon, SearchField, T } from "../../../ui/components";
import { fonts, useTheme } from "../../../ui/theme";
import { whenGita } from "../../../data/gita";
import { authorName, CHAPTERS, langLabel } from "../../../lib/names";
import { scriptFont, toScript } from "../../../lib/script";
import { setSetting } from "../../../state/store";

const SCOPES = [
  { key: "all", label: "All" },
  { key: "verses", label: "Sanskrit" },
  { key: "translations", label: "Translations" },
  { key: "commentaries", label: "Commentaries" },
  { key: "meanings", label: "Word meanings" },
];
const SUGGESTIONS = ["2.47", "karmanye", "कर्मण्ये", "sthita prajna", "fruit of action", "yoga"];
const PAGE = 30;
const NO_RECENT = [];

export default function SearchScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const { c } = useTheme();
  const script = useSelector((s) => s.settings.script);
  const recent = useSelector((s) => s.settings.recentSearches) || NO_RECENT;
  const [q, setQ] = useState(params.q ? String(params.q) : "");
  const [scope, setScope] = useState("all");
  const [chapter, setChapter] = useState(null);
  const [res, setRes] = useState({ results: [] });
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(true);
  const searchRef = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    if (params.q) {
      setQ(String(params.q));
      searchRef.current?.setText?.(String(params.q));
    }
  }, [params.q]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setRes({ results: [] });
      return;
    }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const gita = await whenGita();
        const r = await gita.search(term, { scope, chapter, limit: PAGE, offset: 0 });
        if (my === seq.current) {
          // Hits whose snippet visibly shows the match come first; verses matched
          // only through their word-by-word meanings follow (stable order otherwise).
          const shown = r.results.filter((x) => x.matches?.length);
          const hidden = r.results.filter((x) => !x.matches?.length).map((x) => ({ ...x, viaMeanings: x.kind === "verse" && r.queryType !== "verse" }));
          setRes({ ...r, results: [...shown, ...hidden] });
          setMore(r.results.length >= PAGE);
        }
      } catch (e) {
        if (my === seq.current) setRes({ results: [], error: true });
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, scope, chapter]);

  const remember = () => {
    const term = q.trim();
    if (term.length < 2) return;
    dispatch(setSetting({ recentSearches: [term, ...recent.filter((r) => r !== term)].slice(0, 8) }));
  };

  const loadMore = async () => {
    const gita = await whenGita();
    const r = await gita.search(q.trim(), { scope, chapter, limit: PAGE, offset: res.results.length });
    const extra = r.results.map((x) => (x.matches?.length ? x : { ...x, viaMeanings: x.kind === "verse" }));
    setRes((old) => ({ ...old, results: [...old.results, ...extra] }));
    setMore(r.results.length >= PAGE);
  };

  const openResult = (r) => {
    remember();
    if (r.kind === "commentary" && r.authorId) router.push({ pathname: `/commentary/${r.chapter}/${r.verse}/${r.authorId}`, params: { q: q.trim() } });
    else router.push(`/verse/${r.chapter}/${r.verse}`);
  };

  const useNativeBar = Platform.OS === "ios";
  const rememberRef = useRef(remember);
  rememberRef.current = remember;
  const headerOptions = useMemo(
    () => ({
      title: "Search",
      headerSearchBarOptions: useNativeBar
        ? {
            ref: searchRef,
            placeholder: "Verse, word, phrase or 2.47",
            onChangeText: (e) => setQ(e.nativeEvent.text),
            onSearchButtonPress: () => rememberRef.current(),
            autoCapitalize: "none",
            hideWhenScrolling: false,
            placement: "automatic",
          }
        : undefined,
    }),
    [useNativeBar]
  );
  const header = (
    <View style={{ gap: 10, paddingTop: 8, paddingBottom: 8 }}>
      {!useNativeBar ? <SearchField value={q} onChangeText={setQ} placeholder="Verse, word, phrase or 2.47" style={{ marginHorizontal: 16 }} onSubmit={remember} /> : null}
      <ChipRow>
        {SCOPES.map((s) => (
          <Chip key={s.key} label={s.label} selected={scope === s.key} onPress={() => setScope(s.key)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip label="Any chapter" small selected={!chapter} onPress={() => setChapter(null)} />
        {CHAPTERS.slice(1).map((ch, i) => (
          <Chip key={i} label={`Ch ${i + 1}`} small selected={chapter === i + 1} onPress={() => setChapter(chapter === i + 1 ? null : i + 1)} accessibilityLabel={`Chapter ${i + 1}, ${ch.name}`} />
        ))}
      </ChipRow>
      {q.trim() ? (
        <T v="footnote" muted style={{ paddingHorizontal: 20 }}>
          {busy ? "Searching…" : res.results.length ? `${res.results.length}${more ? "+" : ""} ${res.results.length === 1 && !more ? "result" : "results"}` : ""}
        </T>
      ) : null}
      {res.jump ? (
        <Card tone="accent" style={styles.jump} onPress={() => (res.jump.verse ? router.push(`/verse/${res.jump.chapter}/${res.jump.verse}`) : router.push(`/chapters/${res.jump.chapter}`))}>
          <Icon name="chevronRight" size={16} color={c.accent} />
          <T v="calloutStrong" accent>
            {res.jump.verse ? `Go to verse ${res.jump.chapter}.${res.jump.verse}` : `Open chapter ${res.jump.chapter} · ${CHAPTERS[res.jump.chapter].name}`}
          </T>
        </Card>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <FlatList
        data={q.trim() ? res.results : []}
        keyExtractor={(r, i) => `${r.kind}-${r.textId || r.verseId}-${i}`}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ paddingBottom: 60 }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          q.trim() ? (
            busy ? null : (
              <Empty title="No matches" body="Try fewer words, another spelling, or a different filter." icon="search" />
            )
          ) : (
            <View style={{ gap: 18, paddingTop: 8 }}>
              {recent.length ? (
                <View style={{ gap: 8 }}>
                  <T v="footnoteStrong" muted style={{ paddingHorizontal: 20 }}>
                    Recent
                  </T>
                  <ChipRow>
                    {recent.map((r) => (
                      <Chip key={r} label={r} icon="history" onPress={() => (setQ(r), searchRef.current?.setText?.(r))} />
                    ))}
                  </ChipRow>
                </View>
              ) : null}
              <View style={{ gap: 8 }}>
                <T v="footnoteStrong" muted style={{ paddingHorizontal: 20 }}>
                  Try
                </T>
                <ChipRow>
                  {SUGGESTIONS.map((r) => (
                    <Chip key={r} label={r} onPress={() => (setQ(r), searchRef.current?.setText?.(r))} />
                  ))}
                </ChipRow>
              </View>
              <T v="footnote" muted style={{ paddingHorizontal: 20, lineHeight: 20 }}>
                Search understands verse numbers, Sanskrit in any script, romanised words with or without diacritics, and English or Hindi phrases across all translations and commentaries.
              </T>
            </View>
          )
        }
        ListFooterComponent={q.trim() && more && res.results.length ? <Button title="Show more results" kind="secondary" onPress={loadMore} style={{ margin: 16 }} /> : null}
        renderItem={({ item: r }) => <Result r={r} script={script} onPress={() => openResult(r)} />}
      />
    </>
  );
}

const HIGHLIGHT_STOP = new Set(["of", "the", "a", "an", "to", "in", "on", "and", "or", "is", "be", "by", "for", "at", "as", "it", "his", "her"]);

function Highlighted({ text, matches, style, markStyle, numberOfLines, stripBars }) {
  const parts = [];
  let i = 0;
  // Don't paint tiny function words ("of", "the") when they are part of a phrase.
  const useful = (matches || []).filter((m) => !HIGHLIGHT_STOP.has(text.slice(m.start, m.end).toLowerCase()) || (matches || []).length === 1);
  for (const m of useful) {
    if (m.start > i) parts.push({ t: text.slice(i, m.start) });
    parts.push({ t: text.slice(m.start, m.end), mark: true });
    i = m.end;
  }
  if (i < text.length) parts.push({ t: text.slice(i) });
  return (
    <T style={style} numberOfLines={numberOfLines}>
      {parts.map((p, k) => (
        <T key={k} style={[style, p.mark && markStyle]}>
          {stripBars ? p.t.replace(/[ \t]*\|+/g, "") : p.t}
        </T>
      ))}
    </T>
  );
}

function Result({ r, script, onPress }) {
  const { c } = useTheme();
  const mark = { backgroundColor: c.mark, color: c.ink };
  const isVerse = r.kind === "verse";
  const label = isVerse ? (r.viaMeanings ? "Matched in word meanings" : "Sanskrit") : r.kind === "translation" ? `Translation · ${authorName(r.authorId, r.authorName)}` : `Commentary · ${authorName(r.authorId, r.authorName, "commentary")}`;
  const sc = script === "ro" ? "dv" : script;
  // Verse hits: show the verse in the reader's script; highlight only when the snippet is in that script.
  const devaSnippet = /[ऀ-ॿ]/.test(r.snippet || "");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.result, { backgroundColor: pressed ? c.surface2 : c.surface }]}>
      <View style={styles.between}>
        <T v="footnoteStrong" accent>
          {r.chapter}.{r.verse}
        </T>
        <T v="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
          {label}
          {!isVerse && r.lang ? ` · ${langLabel(r.lang)}` : ""}
        </T>
      </View>
      {isVerse ? (
        devaSnippet && sc === "dv" ? (
          <Highlighted text={r.snippet} matches={r.matches} style={{ fontFamily: fonts.sanskrit, fontSize: 17, lineHeight: 29, color: c.ink }} markStyle={mark} />
        ) : (
          <>
            <T style={{ fontFamily: scriptFont(sc), fontSize: 17, lineHeight: 29, color: c.ink }}>{(r.lines || []).map((l) => toScript(l, sc)).join("\n")}</T>
            {!devaSnippet ? <Highlighted stripBars text={r.snippet} matches={r.matches} style={{ fontFamily: fonts.sanskritItalic, fontSize: 14, lineHeight: 21, color: c.muted }} markStyle={mark} /> : null}
          </>
        )
      ) : (
        <Highlighted
          text={r.snippet}
          matches={r.matches}
          numberOfLines={4}
          style={{ fontFamily: r.lang === "english" ? fonts.serif : fonts.sanskrit, fontSize: 15, lineHeight: 23, color: c.ink2 }}
          markStyle={mark}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  jump: { marginHorizontal: 16, padding: 14, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  result: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, padding: 14, gap: 6 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
});
