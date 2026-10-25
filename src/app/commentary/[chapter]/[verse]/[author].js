import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import SelectionBar from "../../../../ui/SelectionBar";
import useTextSelection from "../../../../ui/useTextSelection";
import { Glass, Icon, IconButton, SearchField, T, tap } from "../../../../ui/components";
import { Blocks, countMatches, Sloka } from "../../../../ui/reading";
import { fonts, useTheme } from "../../../../ui/theme";
import { useTexts, useVerse } from "../../../../data/gita";
import { langLabel } from "../../../../lib/names";
import { scriptByKey, toScript } from "../../../../lib/script";
import { describeText, orderCommentaries, plainText } from "../../../../lib/texts";
import { blocksPropsFor } from "../../../../lib/translate";
import CardMenu, { TranslationNote } from "../../../../ui/CardMenu";
import useCardTranslation from "../../../../ui/useCardTranslation";
import { setSetting, togglePinnedCommentator } from "../../../../state/store";

export default function CommentaryReader() {
  const params = useLocalSearchParams();
  const chapter = Number(params.chapter);
  const v = Number(params.verse);
  const router = useRouter();
  const dispatch = useDispatch();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const settings = useSelector((s) => s.settings);
  const { data: verse } = useVerse(chapter, v);
  const { data: texts } = useTexts(verse?.id, "commentary");
  const ordered = useMemo(() => orderCommentaries(texts, settings.pinnedCommentators), [texts, settings.pinnedCommentators]);
  const [index, setIndex] = useState(-1);
  const [q, setQ] = useState(params.q ? String(params.q) : "");
  const [match, setMatch] = useState(0);
  const [peek, setPeek] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (index === -1 && ordered.length) {
      const i = ordered.findIndex((t) => String(t.authorId) === String(params.author));
      setIndex(Math.max(0, i));
    }
  }, [ordered, index, params.author]);

  const current = ordered[index];
  const terms = useMemo(() => q.trim().split(/\s+/).filter((t) => t.length >= 2), [q]);
  const total = useMemo(() => (current ? countMatches(current.blocks, terms) : 0), [current, terms]);
  useEffect(() => setMatch(0), [index, q]);

  const isSanskritLike = current && (current.lang === "sanskrit" || current.lang === "hindi");
  const scriptOptions = useMemo(() => {
    const keys = ["dv", settings.script !== "dv" && settings.script !== "ro" ? settings.script : "te", "ro"];
    return [...new Set(keys)];
  }, [settings.script]);
  const comScript = scriptOptions.includes(settings.commentaryScript) ? settings.commentaryScript : "dv";

  const go = useCallback(
    (i) => {
      if (i < 0 || i >= ordered.length) return;
      tap();
      listRef.current?.scrollToIndex({ index: i, animated: true });
      setIndex(i);
    },
    [ordered.length]
  );

  const authorId = current?.authorId;
  const isPinned = authorId != null && settings.pinnedCommentators.includes(authorId);
  const d = current ? describeText(current) : null;
  // Memoized: inline options make the native stack re-apply them on every render.
  const headerOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: c.surface },
      headerTitle: () =>
        d ? (
          <View style={{ alignItems: "center", maxWidth: width - 150 }}>
            <T v="headline" numberOfLines={1}>
              {d.name}
            </T>
            <T v="caption" muted numberOfLines={1}>
              {d.school} · {index + 1} of {ordered.length} · swipe for next
            </T>
          </View>
        ) : null,
      headerRight: () =>
        authorId != null ? (
          <IconButton
            name={isPinned ? "pinFill" : "pin"}
            label={isPinned ? "Unpin commentator" : "Pin commentator to the top"}
            color={isPinned ? c.accent : c.ink}
            size={36}
            iconSize={19}
            onPress={() => dispatch(togglePinnedCommentator(authorId))}
          />
        ) : null,
    }),
    [authorId, d?.name, d?.school, index, ordered.length, isPinned, c, width, dispatch] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!current) return <View style={{ flex: 1, backgroundColor: c.surface }} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <Stack.Screen options={headerOptions} />

      <Pressable onPress={() => setPeek((p) => !p)} accessibilityRole="button" accessibilityLabel={peek ? "Hide verse" : "Show verse"} style={[styles.peek, { backgroundColor: c.surface2 }]}>
        {peek && verse ? (
          <View style={{ flex: 1, paddingVertical: 4 }}>
            <Sloka verse={verse} script={settings.script} size={17} showIast={false} />
          </View>
        ) : (
          <>
            <T v="footnoteStrong" accent>
              {chapter}.{v}
            </T>
            <T numberOfLines={1} style={{ flex: 1, fontFamily: fonts.sanskrit, fontSize: 15, lineHeight: 24, color: c.ink }}>
              {verse ? toScript(verse.lines[0], settings.script === "ro" ? "dv" : settings.script) : ""}
            </T>
            <T v="caption" muted>
              Tap to see verse
            </T>
          </>
        )}
      </Pressable>

      <View style={styles.findRow}>
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Find in this commentary"
          style={{ flex: 1, height: 40 }}
          right={
            terms.length ? (
              <T v="footnote" muted>
                {total ? `${match + 1} of ${total}` : "0 found"}
              </T>
            ) : null
          }
        />
        <IconButton name="chevronUp" label="Previous match" size={40} iconSize={16} style={{ backgroundColor: c.surface2, borderRadius: 20, opacity: total ? 1 : 0.4 }} onPress={() => total && setMatch((m) => (m - 1 + total) % total)} />
        <IconButton name="chevronDown" label="Next match" size={40} iconSize={16} style={{ backgroundColor: c.surface2, borderRadius: 20, opacity: total ? 1 : 0.4 }} onPress={() => total && setMatch((m) => (m + 1) % total)} />
      </View>

      <FlatList
        ref={listRef}
        data={ordered}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(t) => String(t.id)}
        windowSize={3}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <Page
            text={item}
            width={width}
            active={i === index}
            terms={i === index ? terms : null}
            match={match}
            script={item.lang === "sanskrit" || item.lang === "hindi" ? comScript : "dv"}
            size={17 * settings.fontScale}
            bottomPad={insets.bottom + 170}
            barBottom={insets.bottom + 76}
            verseKey={`${chapter}.${v}`}
          />
        )}
      />

      <Glass style={[styles.bar, { bottom: insets.bottom + 10 }]}>
        <IconButton name="chevronLeft" label="Previous commentator" onPress={() => go(index - 1)} style={{ opacity: index > 0 ? 1 : 0.3 }} />
        {isSanskritLike ? (
          scriptOptions.map((k) => (
            <Pressable
              key={k}
              onPress={() => dispatch(setSetting({ commentaryScript: k }))}
              accessibilityRole="button"
              accessibilityState={{ selected: comScript === k }}
              style={[styles.scriptBtn, comScript === k && { backgroundColor: c.surface3 }]}
            >
              <T v={comScript === k ? "footnoteStrong" : "footnote"} numberOfLines={1}>
                {scriptByKey[k].label}
              </T>
            </Pressable>
          ))
        ) : (
          <T v="footnote" muted style={{ flex: 1, textAlign: "center" }} numberOfLines={1}>
            {langLabel(current.lang)} · {d.minutes} min read
          </T>
        )}
        <IconButton name="chevronRight" label="Next commentator" onPress={() => go(index + 1)} style={{ opacity: index < ordered.length - 1 ? 1 : 0.3 }} />
      </Glass>
    </View>
  );
}

const Page = memo(function Page({ text, width, terms, match, script, size, bottomPad, verseKey, active, barBottom }) {
  const scrollRef = useRef(null);
  const offsets = useRef({});
  const matchBlock = useRef(-1);
  const d = describeText(text);
  const selection = useTextSelection({ textId: text.id, verseKey, authorName: d.name, authorId: text.authorId, kind: "commentary" });
  const dispatch = useDispatch();
  const pinned = useSelector((st) => st.settings.pinnedCommentators.includes(text.authorId));
  const tx = useCardTranslation({ key: text.id, lang: text.lang, source: text.blocks });

  useEffect(() => {
    if (!active || !terms || !terms.length) return;
    const t = setTimeout(() => {
      const y = offsets.current[matchBlock.current];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 40), animated: true });
    }, 30);
    return () => clearTimeout(t);
  }, [match, terms, active]);

  // Leaving this commentator clears any half-made selection.
  useEffect(() => {
    if (!active && selection.selection) selection.clear();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ width }}>
      <ScrollView ref={scrollRef} style={{ width }} contentContainerStyle={{ padding: 22, paddingTop: 10, paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
        <View style={styles.pageHead}>
          <T v="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
            {d.name} · {langLabel(text.lang)}
          </T>
          <CardMenu
            title={`${d.name} · ${langLabel(text.lang)}`}
            tx={tx}
            text={() => plainText(tx.value)}
            cite={`— ${d.name}, on Bhagavad Gita ${verseKey}`}
            extra={[{ label: pinned ? "Unpin commentator" : "Pin commentator to the top", icon: pinned ? "pinFill" : "pin", onPress: () => dispatch(togglePinnedCommentator(text.authorId)) }]}
          />
        </View>
        {tx.to ? (
          <View style={{ gap: 12 }}>
            <TranslationNote tx={tx} />
            <Blocks blocks={tx.value} {...blocksPropsFor(tx.to)} size={size} />
          </View>
        ) : (
        <Blocks
          blocks={text.blocks}
          lang={text.lang}
          size={size}
          script={script}
          terms={terms}
          currentMatch={match}
          onMatchBlock={(i) => {
            matchBlock.current = i;
          }}
          onBlockLayout={(i, y) => {
            offsets.current[i] = y;
          }}
          highlights={selection.highlights}
          onSelectText={selection.onSelectText}
          resetKey={selection.resetKey}
        />
        )}
        {tx.to ? null : <TranslationNote tx={tx} style={{ marginTop: 12 }} />}
        <T v="caption" muted style={{ marginTop: 24 }}>
          Select any words to highlight them, copy, or add them to your note.
        </T>
        {text.attribution ? (
          <T v="caption" muted style={{ marginTop: 8 }}>
            {text.attribution}
          </T>
        ) : null}
      </ScrollView>
      <SelectionBar {...selection.bar} bottom={barBottom} />
    </View>
  );
});

const styles = StyleSheet.create({
  pageHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6, marginRight: -8 },
  peek: { marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, minHeight: 44, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  findRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10 },
  bar: { position: "absolute", left: 12, right: 12, height: 58, borderRadius: 29, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 4 },
  scriptBtn: { flex: 1, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
});
