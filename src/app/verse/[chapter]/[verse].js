import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Card, Chip, ChipRow, Glass, Icon, IconButton, T, tap } from "../../../ui/components";
import { Blocks, Sloka } from "../../../ui/reading";
import SelectionBar from "../../../ui/SelectionBar";
import Section, { expandSection } from "../../../ui/Section";
import { mapPadacchedaToMeanings, mapTokensToMeanings, wordSourceInfo } from "../../../lib/wordMeanings";
import useTextSelection from "../../../ui/useTextSelection";
import { fonts, useTheme, UI } from "../../../ui/theme";
import { prefetchVerse, useGita, useStudyUnits, useTexts, useVerse, useWordMeanings } from "../../../data/gita";
import { Padaccheda, padacchedaItems, TeluguWords } from "../../../ui/study";
import { useRecitation, useRecitationProgress } from "../../../audio/AudioProvider";
import { AUDIO_ENABLED } from "../../../lib/features";
import { authorName, bookIndex, CHAPTERS, fromBookIndex, langLabel, TOTAL_VERSES, VERSE_COUNTS } from "../../../lib/names";
import { orderCommentaries, pickTranslation, plainText, previewOf, describeText } from "../../../lib/texts";
import { blocksPropsFor } from "../../../lib/translate";
import CardMenu, { TranslationNote } from "../../../ui/CardMenu";
import useCardTranslation from "../../../ui/useCardTranslation";
import { markRead, setLast, setSetting, toggleBookmark, togglePinnedCommentator, unmarkRead } from "../../../state/store";

const PAGES = Array.from({ length: TOTAL_VERSES }, (_, i) => i + 1);

export default function VerseScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const gita = useGita();
  const audio = useRecitation();
  const markOnMove = useSelector((s) => s.settings.markReadOnMove);
  const bookmarks = useSelector((s) => s.library.bookmarks);
  const startIndex = bookIndex(Number(params.chapter), Number(params.verse));
  const [index, setIndex] = useState(startIndex);
  const pos = fromBookIndex(index);
  const key = `${pos.chapter}.${pos.verse}`;
  const listRef = useRef(null);
  const prevIndex = useRef(startIndex);

  // Arriving at a verse: remember the position, preload neighbours.
  useEffect(() => {
    dispatch(setLast(pos));
    for (const d of [-1, 1, 2]) {
      const p = fromBookIndex(Math.min(TOTAL_VERSES, Math.max(1, index + d)));
      prefetchVerse(gita, p.chapter, p.verse);
    }
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-links / pushes to a different verse while mounted.
  useEffect(() => {
    const i = bookIndex(Number(params.chapter), Number(params.verse));
    if (i !== index) goTo(i, false);
  }, [params.chapter, params.verse]); // eslint-disable-line react-hooks/exhaustive-deps

  const settle = useCallback(
    (i) => {
      if (i === prevIndex.current) return;
      if (markOnMove) {
        const p = fromBookIndex(prevIndex.current);
        dispatch(markRead(`${p.chapter}.${p.verse}`));
      }
      prevIndex.current = i;
      setIndex(i);
    },
    [dispatch, markOnMove]
  );

  const goTo = useCallback(
    (i, animated = true) => {
      const t = Math.min(TOTAL_VERSES, Math.max(1, i));
      tap();
      listRef.current?.scrollToIndex({ index: t - 1, animated });
      settle(t);
    },
    [settle]
  );

  // Follow the recitation when it auto-advances to the next verse.
  useEffect(() => {
    if (!audio.current) return;
    const i = bookIndex(audio.current.chapter, audio.current.verse);
    if (i !== index && Math.abs(i - index) === 1) goTo(i);
  }, [audio.current?.chapter, audio.current?.verse]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBookmarked = !!bookmarks[key];
  // Stable header options: re-creating them every render makes the native stack
  // re-apply options in a loop while the recitation updates.
  const headerOptions = useMemo(
    () => ({
          headerStyle: { backgroundColor: c.surface },
          headerTitle: () => (
            <View style={{ alignItems: "center" }}>
              <T v="headline" numberOfLines={1}>
                {key}
              </T>
              <T v="caption" muted numberOfLines={1}>
                {CHAPTERS[pos.chapter].name} · {pos.verse} of {VERSE_COUNTS[pos.chapter]}
              </T>
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
              <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="Reading settings" hitSlop={8} style={styles.headerBtn}>
                <T v="calloutStrong">Aa</T>
              </Pressable>
              <IconButton
                name={isBookmarked ? "bookmarkFill" : "bookmark"}
                label={isBookmarked ? "Remove bookmark" : "Bookmark this verse"}
                color={isBookmarked ? c.accent : c.ink}
                size={36}
                iconSize={19}
                onPress={() => dispatch(toggleBookmark(key))}
              />
            </View>
          ),
        }),
    [key, pos.chapter, pos.verse, isBookmarked, c, router, dispatch]
  );

  const playing = audio.isCurrent(pos.chapter, pos.verse) && audio.playing;
  const onPlay = () => (audio.isCurrent(pos.chapter, pos.verse) ? audio.toggle() : audio.play(pos.chapter, pos.verse, "single"));

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <Stack.Screen options={headerOptions} />
      <FlatList
        ref={listRef}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex - 1}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(i) => String(i)}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        onMomentumScrollEnd={(e) => settle(Math.round(e.nativeEvent.contentOffset.x / width) + 1)}
        renderItem={({ item }) => <VersePage i={item} width={width} bottomPad={insets.bottom + 110} barBottom={insets.bottom + 84} active={item === index} />}
      />

      <Glass interactive style={[styles.player, { bottom: insets.bottom + 10 }]}>
        <IconButton name="chevronLeft" label="Previous verse" onPress={() => goTo(index - 1)} iconSize={22} />
        {AUDIO_ENABLED ? (
          <Pressable onPress={onPlay} accessibilityRole="button" accessibilityLabel={playing ? "Pause recitation" : "Play recitation"} style={[styles.play, { backgroundColor: c.accent }]}>
            <Icon name={playing ? "pause" : "play"} size={18} color={c.onAccent} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 8, gap: 3, alignItems: AUDIO_ENABLED ? "stretch" : "center" }}>
          <T v="footnoteStrong" numberOfLines={1}>
            {!AUDIO_ENABLED
              ? `${key} · ${pos.verse} of ${VERSE_COUNTS[pos.chapter]}`
              : audio.isCurrent(pos.chapter, pos.verse)
                ? audio.buffering
                  ? "Loading recitation…"
                  : `Recitation · ${key}`
                : `Listen to ${key}`}
          </T>
          {AUDIO_ENABLED && audio.isCurrent(pos.chapter, pos.verse) && !audio.error ? (
            <PlayerProgress />
          ) : (
            <T v="caption" muted numberOfLines={1}>
              {audio.error || "Swipe the page for the next verse"}
            </T>
          )}
        </View>
        <IconButton name="chevronRight" label="Next verse" onPress={() => goTo(index + 1)} iconSize={22} />
      </Glass>
    </View>
  );
}

function PlayerProgress() {
  const { c } = useTheme();
  const { currentTime, duration } = useRecitationProgress();
  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: c.surface3 }}>
      <View style={{ width: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%`, height: 3, borderRadius: 2, backgroundColor: c.ink }} />
    </View>
  );
}

// ---------------------------------------------------------------- one verse page
const VersePage = memo(function VersePage({ i, width, bottomPad, barBottom, active }) {
  const { chapter, verse: v } = fromBookIndex(i);
  const router = useRouter();
  const dispatch = useDispatch();
  const { c } = useTheme();
  const s = useSelector((st) => st.settings);
  const note = useSelector((st) => st.library.notes[`${chapter}.${v}`]);
  const isRead = useSelector((st) => !!st.progress.read[`${chapter}.${v}`]);
  const { data: verse } = useVerse(chapter, v);
  const { data: words } = useWordMeanings(verse);
  const { data: translations } = useTexts(verse?.id, "translation");
  const { data: commentaries } = useTexts(verse?.id, "commentary");
  const { data: study } = useStudyUnits(verse?.id);
  const teluguScript = s.teluguScript === "follow" ? s.script : "te";
  const showPad = s.showPadaccheda !== false && !!study?.some((u) => (u.blocks || []).some((b) => b.padaccheda && (b.verses || []).includes(v)));
  const scrollRef = useRef(null);
  const offsets = useRef({});
  const size = 23 * s.fontScale;

  const tokenMap = useMemo(() => (verse && words?.meanings?.length ? mapTokensToMeanings(verse.iastLines, words.meanings, words.words) : null), [verse, words]);
  const tr = pickTranslation(translations, s.primaryTranslatorId);
  const selection = useTextSelection({
    textId: tr?.id,
    verseKey: `${chapter}.${v}`,
    authorName: tr ? authorName(tr.authorId, tr.authorName) : "",
    authorId: tr?.authorId,
    kind: "translation",
  });
  useEffect(() => {
    if (!active && selection.selection) selection.clear();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const trTx = useCardTranslation({ key: tr?.id, lang: tr?.lang, source: tr?.blocks });
  const wordsLang = words?.lang || "english";
  const wTx = useCardTranslation({ key: verse && words ? `${verse.id}:${words.source}` : null, lang: wordsLang, source: words?.meanings, kind: "meanings" });
  const meanings = wTx.value || [];
  const coms = useMemo(() => orderCommentaries(commentaries, s.pinnedCommentators), [commentaries, s.pinnedCommentators]);
  const pinnedComs = coms.filter((t) => s.pinnedCommentators.includes(t.authorId)).slice(0, 2);
  const openWord = (tokenIdx) => router.push(`/word/${chapter}/${v}/${tokenMap ? tokenMap[tokenIdx] ?? 0 : 0}`);
  // Padaccheda words → word-by-word entries; a padaccheda word glossed in parts opens them together.
  const padMap = useMemo(
    () => (showPad && words?.meanings?.length ? mapPadacchedaToMeanings(padacchedaItems(study, v), words.meanings, words.words) : null),
    [showPad, study, v, words]
  );
  const openPadWord = (k) => {
    const [first = 0, ...rest] = padMap?.[k] || [];
    router.push({ pathname: `/word/${chapter}/${v}/${first}`, params: rest.length ? { with: rest.join(",") } : {} });
  };
  const collapsedMap = useSelector((st) => st.settings.collapsedSections);
  const jump = (k) => {
    expandSection(dispatch, collapsedMap, k);
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (offsets.current[k] || 0) - 8), animated: true }), collapsedMap?.[k] ? 80 : 0);
  };
  const mark = (k) => (e) => {
    offsets.current[k] = e.nativeEvent.layout.y;
  };

  return (
    <View style={{ width }}>
    <ScrollView ref={scrollRef} style={{ width }} contentContainerStyle={{ paddingBottom: bottomPad }} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <View style={styles.verseBlock}>
        {verse ? (
          <Sloka verse={verse} script={s.script} size={size} showIast={s.showIast} onWordPress={tokenMap ? openWord : undefined} />
        ) : (
          <View style={{ height: 160 }} />
        )}
        {tokenMap ? (
          <T v="caption" muted style={{ marginTop: 6 }}>
            Tap any word for its meaning and grammar
          </T>
        ) : null}
      </View>

      <ChipRow style={[styles.jumpRow, { borderColor: c.line }]} contentStyle={{ paddingVertical: 8 }}>
        <Chip label={`Translations ${translations?.length || ""}`.trim()} tone="surface2" small onPress={() => jump("translation")} />
        {showPad ? <Chip label="Padaccheda" tone="surface2" small onPress={() => jump("padaccheda")} /> : null}
        <Chip label="Words" tone="surface2" small onPress={() => jump("words")} />
        <Chip label={`Commentaries ${commentaries?.length || ""}`.trim()} tone="surface2" small onPress={() => jump("commentary")} />
        <Chip label={note ? "Your note" : "Note"} tone="surface2" small onPress={() => jump("note")} />
      </ChipRow>

      {/* Translation */}
      {tr ? (
        <Section
          id="translation"
          onLayout={mark("translation")}
          style={styles.section}
          title={`${authorName(tr.authorId, tr.authorName)} · ${langLabel(tr.lang)}`}
          right={`Compare all ${translations.length}`}
          onRightPress={() => router.push(`/compare/${chapter}/${v}`)}
          menu={
            <CardMenu
              title={`${authorName(tr.authorId, tr.authorName)} · ${langLabel(tr.lang)}`}
              tx={trTx}
              text={() => plainText(trTx.value)}
              cite={`— ${authorName(tr.authorId, tr.authorName)}, Bhagavad Gita ${chapter}.${v}`}
              extra={
                tr.authorId !== s.primaryTranslatorId
                  ? [{ label: "Make default translation", icon: "star", onPress: () => dispatch(setSetting({ primaryTranslatorId: tr.authorId })) }]
                  : []
              }
            />
          }
        >
          {trTx.to ? (
            // Highlights and selection belong to the original wording, so a translation is read-only.
            <Blocks blocks={trTx.value} {...blocksPropsFor(trTx.to)} size={18 * s.fontScale} />
          ) : (
            <Blocks
              blocks={tr.blocks}
              lang={tr.lang}
              teluguScript={teluguScript}
              size={18 * s.fontScale}
              highlights={selection.highlights}
              onSelectText={selection.onSelectText}
              resetKey={selection.resetKey}
            />
          )}
          <TranslationNote tx={trTx} />
        </Section>
      ) : null}

      {/* Padaccheda (Swami Nirvikalpananda) */}
      {showPad ? (
        <Section id="padaccheda" onLayout={mark("padaccheda")} style={styles.section} title="Padaccheda · పదచ్ఛేదః" right="Swami Nirvikalpananda">
          <Padaccheda units={study} chapter={chapter} verseNo={v} script={s.script} size={17 * s.fontScale} onWordPress={padMap ? openPadWord : undefined} />
        </Section>
      ) : null}

      {/* Word by word */}
      <Section
        id="words"
        onLayout={mark("words")}
        style={styles.section}
        title="Word by word"
        right={words ? wordSourceInfo(words.source).name : ""}
        menu={
          words?.meanings?.length ? (
            <CardMenu
              title={`Word by word · ${wordSourceInfo(words.source).name}`}
              tx={wTx}
              text={() => meanings.map((m) => `${m.termIast} — ${m.meaning}`).join("\n")}
              cite={`— ${wordSourceInfo(words.source).name}, Bhagavad Gita ${chapter}.${v}`}
            />
          ) : null
        }
      >
        {words?.lang === "telugu" ? (
          <TeluguWords
            meanings={meanings}
            meaningFont={wTx.to ? blocksPropsFor(wTx.to).font : undefined}
            units={words.units}
            chapter={chapter}
            verseNo={v}
            script={s.script}
            teluguScript={teluguScript}
            size={15 * s.fontScale}
            onWordPress={(k) => router.push(`/word/${chapter}/${v}/${k}`)}
          />
        ) : (
          <T style={{ ...UI.regular, fontSize: 15 * s.fontScale, lineHeight: 25 * s.fontScale, color: c.ink2 }}>
            {meanings.map((m, k) => (
              <T key={k} style={{ ...UI.regular, fontSize: 15 * s.fontScale, color: c.ink2 }} onPress={() => router.push(`/word/${chapter}/${v}/${k}`)}>
                <T style={{ fontFamily: fonts.sanskritItalic, fontSize: 15 * s.fontScale, color: c.accent }}>{m.termIast}</T>
                {` — ${m.meaning}`}
                {k < meanings.length - 1 ? ";  " : ""}
              </T>
            ))}
          </T>
        )}
        <TranslationNote tx={wTx} />
      </Section>

      {/* Commentaries */}
      <Section id="commentary" onLayout={mark("commentary")} style={styles.section} title="Commentaries" right={commentaries?.length ? `${commentaries.length} available` : undefined}>
        {pinnedComs.map((t) => (
          <PinnedCommentary key={t.id} t={t} chapter={chapter} v={v} />
        ))}
        <Card tone="muted" style={styles.allCom} onPress={() => router.push(`/commentaries/${chapter}/${v}`)} accessibilityLabel="All commentaries">
          <View style={{ flex: 1, gap: 2 }}>
            <T v="calloutStrong" numberOfLines={1}>
              {commentaries?.length || 0} commentaries on this verse
            </T>
            <T v="footnote" muted numberOfLines={1}>
              Search inside them, filter by school and language
            </T>
          </View>
          <Icon name="chevronRight" size={15} color={c.muted} />
        </Card>
      </Section>

      {/* Note */}
      <Section id="note" onLayout={mark("note")} style={styles.section} title="Your note">
        <Card tone="muted" style={{ borderRadius: 16, padding: 14 }} onPress={() => router.push(`/note/${chapter}/${v}`)} accessibilityLabel={note ? "Edit your note" : "Add a note"}>
          {note ? (
            <T v="body" color={c.ink}>
              {note.text}
            </T>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name="note" size={18} color={c.accent} />
              <T v="callout" muted>
                Add a reflection on this verse
              </T>
            </View>
          )}
        </Card>
        <Pressable
          onPress={() => dispatch(isRead ? unmarkRead(`${chapter}.${v}`) : markRead(`${chapter}.${v}`))}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isRead }}
          style={styles.readRow}
        >
          <Icon name={isRead ? "checkCircle" : "check"} size={18} color={isRead ? c.success : c.muted} />
          <T v="callout" color={isRead ? c.success : c.muted}>
            {isRead ? "Marked as read" : "Mark as read"}
          </T>
        </Pressable>
      </Section>
    </ScrollView>
    <SelectionBar {...selection.bar} bottom={barBottom} />
    </View>
  );
});

/** A pinned commentator's opening lines, with its ⋯ menu (translate, copy, share, unpin). */
function PinnedCommentary({ t, chapter, v }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { c } = useTheme();
  const d = describeText(t);
  const tx = useCardTranslation({ key: t.id, lang: t.lang, source: t.blocks });
  const font = tx.to ? blocksPropsFor(tx.to).font : t.lang === "english" ? fonts.serif : fonts.sanskrit;
  return (
    <Card tone="muted" style={styles.comCard} onPress={() => router.push(`/commentary/${chapter}/${v}/${t.authorId}`)} accessibilityLabel={`Read ${d.name}`}>
      <View style={styles.between}>
        <T v="subheadStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
          {d.name}
        </T>
        <View style={styles.cardEnd}>
          <T v="caption" muted numberOfLines={1}>
            {langLabel(t.lang)} · {d.minutes} min
          </T>
          <CardMenu
            size={28}
            title={`${d.name} · ${langLabel(t.lang)}`}
            tx={tx}
            text={() => plainText(tx.value)}
            cite={`— ${d.name}, on Bhagavad Gita ${chapter}.${v}`}
            extra={[{ label: "Unpin commentator", icon: "pin", onPress: () => dispatch(togglePinnedCommentator(t.authorId)) }]}
          />
        </View>
      </View>
      <T numberOfLines={3} style={{ fontFamily: font, fontSize: 15, lineHeight: 24, color: c.ink2 }}>
        {previewOf(tx.value, 220)}
      </T>
      <TranslationNote tx={tx} />
    </Card>
  );
}

const styles = StyleSheet.create({
  cardEnd: { flexDirection: "row", alignItems: "center", gap: 2, marginRight: -6 },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  verseBlock: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16, alignItems: "center" },
  jumpRow: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 6 },
  section: { paddingHorizontal: 22, paddingTop: 18, gap: 8 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  comCard: { borderRadius: 16, padding: 14, gap: 6 },
  allCom: { borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  readRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, alignSelf: "flex-start" },
  player: { position: "absolute", left: 12, right: 12, height: 64, borderRadius: 32, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 2 },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
