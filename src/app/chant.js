import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Icon, T, tap } from "../ui/components";
import { Blocks, Sloka } from "../ui/reading";
import { fonts, UI } from "../ui/theme";
import { useChapterVerses, useTexts } from "../data/gita";
import { useRecitation } from "../audio/AudioProvider";
import { AUDIO_ENABLED } from "../lib/features";
import { bookIndex, CHAPTERS, TOTAL_VERSES, VERSE_COUNTS } from "../lib/names";
import { toScript } from "../lib/script";
import { pickTranslation } from "../lib/texts";
import { markRead, setSetting } from "../state/store";

// Chanting is always shown dark, like a lamp-lit page.
const K = {
  bg: "#0E0E10",
  ink: "#FFF8EE",
  dim: "#8E8A84",
  sub: "#C9C3B9",
  muted: "#A29D95",
  accent: "#F0A55B",
  onAccent: "#1A0F05",
  glass: "rgba(30,30,33,0.97)",
  line: "rgba(255,255,255,0.16)",
};
const REPEATS = [1, 2, 3, 5];
const SCROLL_SPEEDS = [0, 18, 36]; // px per second

function buildItems(scope, chapter) {
  const items = [];
  const chapters = scope === "book" ? CHAPTERS.slice(1).map((_, i) => i + 1) : [chapter];
  for (const c of chapters) {
    items.push({ type: "head", chapter: c, key: `h${c}` });
    for (let v = 1; v <= VERSE_COUNTS[c]; v++) items.push({ type: "verse", chapter: c, verse: v, key: `${c}.${v}` });
    items.push({ type: "end", chapter: c, key: `e${c}` });
  }
  return items;
}

export default function Chant() {
  useKeepAwake();
  const params = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const audio = useRecitation();
  const s = useSelector((st) => st.settings);
  const startChapter = Number(params.chapter) || 1;
  const [scope, setScope] = useState(s.chantScope || "chapter");
  const [focus, setFocus] = useState({ chapter: startChapter, verse: 1 });
  const [speed, setSpeed] = useState(0);
  const listRef = useRef(null);
  const offset = useRef(0);
  const userScrolling = useRef(false);
  const items = useMemo(() => buildItems(scope, startChapter), [scope, startChapter]);
  const indexOf = useCallback((c, v) => items.findIndex((it) => it.type === "verse" && it.chapter === c && it.verse === v), [items]);

  // Where each row sits in the list, and how much of the screen is free to read in,
  // so the verse at the middle of the visible area is the one in focus.
  const rows = useRef(new Map());
  const view = useRef({ listH: 0, contentH: 0, controlsH: 0 });
  const [range, setRange] = useState({ lo: -1, hi: -1 });
  const updateFocus = useCallback(() => {
    const { listH, contentH, controlsH } = view.current;
    if (!listH) return;
    const y = offset.current;
    const visibleH = Math.max(1, listH - controlsH);
    const line = y + visibleH / 2;
    let best = -1;
    let bestD = Infinity;
    let first = -1;
    let last = -1;
    rows.current.forEach((r, i) => {
      if (items[i]?.type !== "verse") return;
      if (first < 0 || i < first) first = i;
      if (i > last) last = i;
      const d = line < r.y ? r.y - line : line > r.y + r.h ? line - r.y - r.h : 0;
      if (d < bestD || (d === bestD && i < best)) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) return;
    // At either end of the list the middle can't reach the outermost verses, so
    // everything between the edge and the middle counts as in focus.
    const atTop = y <= 4;
    const atEnd = contentH > 0 && y >= contentH - listH - 4;
    const lastVerse = items.reduce((k, it, i) => (it.type === "verse" ? i : k), -1);
    const firstVerse = items.findIndex((it) => it.type === "verse");
    const lo = atTop ? firstVerse : best;
    const hi = atEnd ? lastVerse : best;
    setRange((r) => (r.lo === lo && r.hi === hi ? r : { lo, hi }));
    const it = items[best];
    setFocus((f) => (f.chapter === it.chapter && f.verse === it.verse ? f : { chapter: it.chapter, verse: it.verse }));
  }, [items]);
  useEffect(() => {
    rows.current = new Map();
  }, [items]);
  // A cell that reports its position in the list (FlatList's own onLayout is still called).
  const Cell = useMemo(
    () =>
      function Cell({ index, onLayout, cellKey, item, ...props }) { // eslint-disable-line no-unused-vars
        return (
          <View
            {...props}
            onLayout={(e) => {
              onLayout?.(e);
              const { y, height } = e.nativeEvent.layout;
              rows.current.set(index, { y, h: height });
              updateFocus();
            }}
          />
        );
      },
    [updateFocus]
  );

  // In whole-book mode, start at the beginning of the chosen chapter.
  useEffect(() => {
    const i = scope === "book" ? items.findIndex((it) => it.type === "head" && it.chapter === startChapter) : 0;
    setTimeout(() => listRef.current?.scrollToIndex({ index: Math.max(0, i), animated: false, viewPosition: 0 }), 50);
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const chanting = audio.current && (audio.current.mode === "chapter" || audio.current.mode === "book");
  const active = chanting ? audio.current : focus;
  // Each verse is "read" (passed), "on" (being read) or "next" (still ahead).
  const activeRange = useMemo(() => {
    if (!chanting) return range;
    const i = indexOf(audio.current.chapter, audio.current.verse);
    return { lo: i, hi: i };
  }, [chanting, range, audio.current?.chapter, audio.current?.verse, indexOf]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the recitation; mark each chanted verse as read.
  const lastChanted = useRef(null);
  useEffect(() => {
    if (!chanting) return;
    const { chapter: c, verse: v } = audio.current;
    if (lastChanted.current && lastChanted.current !== `${c}.${v}`) dispatch(markRead(lastChanted.current));
    lastChanted.current = `${c}.${v}`;
    const i = indexOf(c, v);
    if (i >= 0 && !userScrolling.current) listRef.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.4 });
  }, [audio.current?.chapter, audio.current?.verse, chanting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent auto-scroll for reading along without audio.
  useEffect(() => {
    if (!SCROLL_SPEEDS[speed] || chanting) return;
    const px = SCROLL_SPEEDS[speed] / 20;
    const t = setInterval(() => {
      if (userScrolling.current) return;
      offset.current += px;
      listRef.current?.scrollToOffset({ offset: offset.current, animated: false });
    }, 50);
    return () => clearInterval(t);
  }, [speed, chanting]);

  const togglePlay = () => {
    tap();
    if (chanting) return audio.toggle();
    audio.play(focus.chapter, focus.verse, scope, { repeat: s.chantRepeat });
  };

  const switchScope = (next) => {
    tap();
    setScope(next);
    dispatch(setSetting({ chantScope: next }));
    if (chanting) audio.play(audio.current.chapter, audio.current.verse, next, { repeat: s.chantRepeat });
  };

  const done = scope === "book" ? bookIndex(active.chapter, active.verse) : active.verse;
  const total = scope === "book" ? TOTAL_VERSES : VERSE_COUNTS[startChapter];

  return (
    <View style={{ flex: 1, backgroundColor: K.bg }}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              if (chanting) audio.stop();
              router.back();
            }}
            accessibilityRole="button"
            accessibilityLabel="Exit chanting"
            style={styles.round}
          >
            <Icon name="close" size={17} color={K.ink} />
          </Pressable>
          <View style={{ alignItems: "center", flex: 1 }}>
            <T v="calloutStrong" color={K.ink} numberOfLines={1}>
              {scope === "book" ? "Whole Gita · Chanting" : `Chapter ${startChapter} · Chanting`}
            </T>
            <T v="caption" color={K.muted} numberOfLines={1}>
              {scope === "book" ? `${active.chapter}.${active.verse} · verse ${done} of ${total}` : `Verse ${active.verse} of ${total}`}
            </T>
          </View>
          <Pressable
            onPress={() => {
              tap();
              dispatch(setSetting({ chantShowIast: !s.chantShowIast }));
            }}
            accessibilityRole="button"
            accessibilityLabel="Toggle transliteration"
            style={styles.round}
          >
            <T v="footnoteStrong" color={s.chantShowIast ? K.accent : K.ink}>
              Aa
            </T>
          </Pressable>
        </View>
        <View style={styles.seg} accessibilityRole="radiogroup">
          {[
            ["chapter", "This chapter"],
            ["book", "Whole Gita"],
          ].map(([k, l]) => (
            <Pressable key={k} onPress={() => switchScope(k)} accessibilityRole="radio" accessibilityState={{ checked: scope === k }} style={[styles.segItem, scope === k && { backgroundColor: K.accent }]}>
              <T v="footnoteStrong" color={scope === k ? K.onAccent : K.sub} numberOfLines={1}>
                {l}
              </T>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(it) => it.key}
        renderItem={({ item, index }) => (
          <Row
            item={item}
            state={index < activeRange.lo ? "read" : index <= activeRange.hi ? "on" : "next"}
            showIast={s.chantShowIast}
            showMeaning={s.chantShowMeaning}
            script={s.script}
            primary={s.primaryTranslatorId}
            scale={s.fontScale}
          />
        )}
        extraData={activeRange}
        CellRendererComponent={Cell}
        onLayout={(e) => {
          view.current.listH = e.nativeEvent.layout.height;
          updateFocus();
        }}
        onContentSizeChange={(_, h) => {
          view.current.contentH = h;
          updateFocus();
        }}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 220, paddingHorizontal: 24 }}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
          updateFocus();
        }}
        scrollEventThrottle={32}
        onScrollBeginDrag={() => {
          userScrolling.current = true;
        }}
        onMomentumScrollEnd={() => {
          userScrolling.current = false;
        }}
        onScrollEndDrag={() => setTimeout(() => (userScrolling.current = false), 800)}
        onScrollToIndexFailed={(e) => {
          listRef.current?.scrollToOffset({ offset: e.averageItemLength * e.index, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index: e.index, animated: false, viewPosition: 0.3 }), 120);
        }}
        initialNumToRender={8}
        windowSize={9}
      />

      <View
        style={[styles.controls, { bottom: insets.bottom + 10 }]}
        onLayout={(e) => {
          view.current.controlsH = e.nativeEvent.layout.height + insets.bottom + 10;
          updateFocus();
        }}
      >
        <View style={styles.ctrlRow}>
          <Pressable
            onPress={AUDIO_ENABLED ? togglePlay : () => (tap(), setSpeed((x) => (x ? 0 : 1)))}
            accessibilityRole="button"
            accessibilityLabel={AUDIO_ENABLED ? (chanting && audio.playing ? "Pause recitation" : "Play recitation") : speed ? "Stop auto-scroll" : "Start auto-scroll"}
            style={styles.play}
          >
            <Icon name={(AUDIO_ENABLED ? chanting && audio.playing : !!speed) ? "pause" : "play"} size={20} color={K.onAccent} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <T v="subheadStrong" color={K.ink} numberOfLines={1}>
              {chanting ? (audio.buffering ? "Loading…" : "Recitation + auto-scroll") : speed ? `Auto-scrolling · ${speed}×` : AUDIO_ENABLED ? "Tap play to chant along" : "Tap play to scroll and read along"}
            </T>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }}>
              <View style={{ width: `${(done / total) * 100}%`, height: 4, borderRadius: 2, backgroundColor: K.accent }} />
            </View>
          </View>
          {AUDIO_ENABLED ? (
          <Pressable
            onPress={() => {
              tap();
              const next = REPEATS[(REPEATS.indexOf(s.chantRepeat) + 1) % REPEATS.length];
              dispatch(setSetting({ chantRepeat: next }));
              audio.setRepeat(next);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Repeat each verse ${s.chantRepeat} times`}
            style={styles.pill}
          >
            <T v="caption" color={K.ink} style={{ ...UI.semibold }} numberOfLines={1}>
              Repeat ×{s.chantRepeat}
            </T>
          </Pressable>
          ) : null}
        </View>
        <View style={styles.ctrlRow}>
          <Toggle label="Transliteration" on={s.chantShowIast} onPress={() => dispatch(setSetting({ chantShowIast: !s.chantShowIast }))} />
          <Toggle label="Meaning" on={s.chantShowMeaning} onPress={() => dispatch(setSetting({ chantShowMeaning: !s.chantShowMeaning }))} />
          <Toggle label={speed ? `Scroll ${speed}×` : "Auto-scroll"} on={!!speed} onPress={() => setSpeed((x) => (x + 1) % SCROLL_SPEEDS.length)} />
        </View>
      </View>
    </View>
  );
}

function Toggle({ label, on, onPress }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[styles.toggle, on ? { backgroundColor: "rgba(255,255,255,0.16)" } : { borderWidth: 1, borderColor: K.line }]}
    >
      <T v="caption" color={on ? K.ink : K.sub} style={{ ...UI.semibold }} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

const Row = memo(function Row({ item, state, showIast, showMeaning, script, primary, scale }) {
  if (item.type === "head") {
    const ch = CHAPTERS[item.chapter];
    return (
      <View style={styles.head}>
        <View style={styles.rule} />
        <T style={{ fontFamily: fonts.sanskrit, fontSize: 18, lineHeight: 28, color: K.accent, textAlign: "center" }}>{toScript(`${ch.ordinal} · ${ch.sa}`, script === "ro" ? "dv" : script)}</T>
        <T v="caption" color={K.muted} style={{ textAlign: "center" }}>
          Chapter {item.chapter} · {ch.name} · {VERSE_COUNTS[item.chapter]} verses
        </T>
      </View>
    );
  }
  if (item.type === "end") {
    const ch = CHAPTERS[item.chapter];
    const colophon = `ॐ तत्सदिति श्रीमद्भगवद्गीतासूपनिषत्सु ब्रह्मविद्यायां योगशास्त्रे श्रीकृष्णार्जुनसंवादे ${ch.sa.replace(/ः$/, "ो")} नाम ${ch.ordinal} ॥`;
    return (
      <T style={{ fontFamily: fonts.sanskrit, fontSize: 14, lineHeight: 24, color: K.dim, textAlign: "center", marginBottom: 34, paddingHorizontal: 8 }}>
        {toScript(colophon, script)}
      </T>
    );
  }
  return <VerseItem item={item} state={state} showIast={showIast} showMeaning={showMeaning} script={script} primary={primary} scale={scale} />;
});

function VerseItem({ item, state, showIast, showMeaning, script, primary, scale }) {
  const { data: verses } = useChapterVerses(item.chapter);
  const verse = verses?.[item.verse - 1];
  const { data: texts } = useTexts(showMeaning ? verse?.id : null, "translation");
  const tr = showMeaning ? pickTranslation(texts, primary) : null;
  // Focus drifts softly from verse to verse: every verse keeps one size (so nothing
  // reflows) and only fades and settles in scale, on the native thread.
  const level = FOCUS_LEVEL[state];
  const anim = useRef(new Animated.Value(level)).current;
  useEffect(() => {
    const a = Animated.timing(anim, { toValue: level, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [level, anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [0.32, 0.5, 1] });
  const zoom = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [0.9, 0.9, 1] });
  return (
    <Animated.View style={{ marginBottom: 34, alignItems: "center", opacity, transform: [{ scale: zoom }] }}>
      {verse ? (
        // Reach past the page gutter so sloka lines get nearly the full width.
        <View style={{ alignSelf: "stretch", marginHorizontal: -14 }}>
          <Sloka verse={verse} script={script} size={23 * scale} showIast={showIast} color={K.ink} dimColor={K.sub} />
        </View>
      ) : (
        <View style={{ height: 80 }} />
      )}
      {tr ? (
        <View style={{ marginTop: 10 }}>
          <T style={{ fontFamily: fonts.serif, fontSize: 15 * scale, lineHeight: 23 * scale, color: K.sub, textAlign: "center" }}>
            {(tr.blocks || [])
              .filter((b) => b.type !== "footnotes")
              .map((b) => (b.text || (b.lines || []).join(" ")).replace(/[⟦⟧]/g, "").replace(/⁽\d+⁾/g, ""))
              .join(" ")}
          </T>
        </View>
      ) : null}
    </Animated.View>
  );
}

// Passed verses fade furthest, verses ahead a little less, the verse in focus is full.
const FOCUS_LEVEL = { read: 0, next: 1, on: 2 };

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingBottom: 10, gap: 10, backgroundColor: "rgba(14,14,16,0.94)" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  seg: { alignSelf: "center", flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18, padding: 3 },
  segItem: { height: 32, paddingHorizontal: 16, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  head: { alignItems: "center", gap: 6, marginBottom: 30, marginTop: 6 },
  rule: { width: 40, height: 1, backgroundColor: "#4A4744", marginBottom: 6 },
  controls: { position: "absolute", left: 12, right: 12, borderRadius: 30, backgroundColor: K.glass, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", padding: 12, gap: 10 },
  ctrlRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  play: { width: 52, height: 52, borderRadius: 26, backgroundColor: K.accent, alignItems: "center", justifyContent: "center" },
  pill: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  toggle: { flex: 1, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
});
