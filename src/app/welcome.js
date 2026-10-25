import { useRef, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Button, Card, Chip, Icon, T, tap } from "../ui/components";
import { Sloka } from "../ui/reading";
import { fonts, useTheme, UI } from "../ui/theme";
import { useVerse } from "../data/gita";
import { SCRIPTS } from "../lib/script";
import { availableWordSources, DEFAULT_WORD_SOURCE } from "../lib/wordMeanings";
import { setSetting } from "../state/store";

/**
 * First-run tutorial. Each step shows a real piece of the app (not a stock
 * picture) so readers recognise it later. The last step sets their script.
 */
export default function Welcome() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const list = useRef(null);

  const steps = [Hello, ReadVerse, Words, Commentaries, Highlight, Search, Chant, MakeItYours];
  const last = i === steps.length - 1;

  const finish = () => {
    dispatch(setSetting({ onboarded: true }));
    router.back();
  };
  const go = (n) => {
    tap();
    const t = Math.max(0, Math.min(steps.length - 1, n));
    list.current?.scrollToIndex({ index: t, animated: true });
    setI(t);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={styles.top}>
        <T v="footnote" muted>
          {i + 1} of {steps.length}
        </T>
        {!last ? (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip the tutorial">
            <T v="calloutStrong" accent>
              Skip
            </T>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={list}
        data={steps}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, k) => String(k)}
        getItemLayout={(_, k) => ({ length: width, offset: width * k, index: k })}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item: Step }) => (
          <ScrollView style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
            <Step />
          </ScrollView>
        )}
      />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: i + 1 }}>
          {steps.map((_, k) => (
            <View key={k} style={[styles.dot, { backgroundColor: k === i ? c.accent : c.surface3, width: k === i ? 22 : 8 }]} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {i > 0 ? <Button title="Back" kind="secondary" onPress={() => go(i - 1)} style={{ flex: 1, backgroundColor: c.surface }} /> : null}
          <Button title={last ? "Start reading" : i === 0 ? "Show me around" : "Next"} onPress={() => (last ? finish() : go(i + 1))} style={{ flex: 2 }} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- building blocks
function Head({ eyebrow, title, body }) {
  return (
    <View style={{ gap: 8 }}>
      {eyebrow ? (
        <T v="eyebrow" accent>
          {eyebrow}
        </T>
      ) : null}
      <T v="title" style={{ fontSize: 26, lineHeight: 32 }}>
        {title}
      </T>
      <T v="body" muted style={{ lineHeight: 24 }}>
        {body}
      </T>
    </View>
  );
}

function Tip({ icon, children }) {
  const { c } = useTheme();
  return (
    <View style={styles.tip}>
      <View style={[styles.tipIcon, { backgroundColor: c.accentSoft }]}>
        <Icon name={icon} size={17} color={c.accent} />
      </View>
      <T v="callout" style={{ flex: 1, lineHeight: 22 }}>
        {children}
      </T>
    </View>
  );
}

function Demo({ children, style }) {
  const { c } = useTheme();
  return <View style={[styles.demo, { backgroundColor: c.surface, borderColor: c.line }, style]}>{children}</View>;
}

// ---------------------------------------------------------------- steps
function Hello() {
  const { c } = useTheme();
  return (
    <View style={{ gap: 26, alignItems: "center", paddingTop: 24 }}>
      <Image source={require("../../assets/splash-feather.png")} style={{ width: 120, height: 120 }} resizeMode="contain" accessibilityIgnoresInvertColors />
      <View style={{ alignItems: "center", gap: 6 }}>
        <T style={{ fontFamily: fonts.sanskrit, fontSize: 34, lineHeight: 50, color: c.accent }}>श्रीमद्भगवद्गीता</T>
        <T v="title" style={{ textAlign: "center" }}>
          Welcome to Gita All-In-One
        </T>
      </View>
      <T v="body" muted style={{ textAlign: "center", lineHeight: 24 }}>
        All verses with the words explained, a dozen translations and the great commentaries — from Śaṅkarācārya to Swami Sivananda — free, offline and without ads.
      </T>
      <T v="callout" muted style={{ textAlign: "center" }}>
        A one-minute tour shows you how to study with it.
      </T>
    </View>
  );
}

function ReadVerse() {
  const { c } = useTheme();
  const script = useSelector((s) => s.settings.script);
  const { data: verse } = useVerse(2, 47);
  return (
    <View style={{ gap: 22 }}>
      <Head eyebrow="Reading" title="One verse at a time" body="Every verse has its own page: the Sanskrit laid out line by line, its transliteration, then a translation." />
      <Demo style={{ alignItems: "center", paddingVertical: 20 }}>
        <T v="caption" muted style={{ marginBottom: 6 }}>
          2.47 · Sāṅkhya Yoga
        </T>
        {verse ? <Sloka verse={verse} script={script} size={19} showIast /> : <View style={{ height: 120 }} />}
        <View style={[styles.swipe, { backgroundColor: c.surface2 }]}>
          <Icon name="chevronLeft" size={14} color={c.muted} />
          <T v="caption" muted>
            Swipe for the previous or next verse
          </T>
          <Icon name="chevronRight" size={14} color={c.muted} />
        </View>
      </Demo>
      <View style={{ gap: 12 }}>
        <Tip icon="chapters">Open a chapter from the Chapters tab, or tap “Continue reading” on Today to pick up where you left off.</Tip>
        <Tip icon="check">Verses you read are ticked off automatically, and your progress shows in the Library.</Tip>
      </View>
    </View>
  );
}

function Words() {
  const { c } = useTheme();
  return (
    <View style={{ gap: 22 }}>
      <Head eyebrow="Understanding" title="Tap any word" body="Tap a word in the verse to see its meaning, its root and its grammar. The arrows walk you through the verse word by word." />
      <Demo style={{ gap: 14 }}>
        <T style={{ fontFamily: fonts.sanskrit, fontSize: 21, lineHeight: 34, textAlign: "center", color: c.ink }}>
          कर्मण्येवाधिकारस्ते मा <T style={{ fontFamily: fonts.sanskrit, fontSize: 21, backgroundColor: c.accentSoft2, color: c.accentPressed }}>फलेषु</T> कदाचन ।
        </T>
        <View style={[styles.sheet, { backgroundColor: c.surface2 }]}>
          <T style={{ fontFamily: fonts.sanskritItalic, fontSize: 17, color: c.accent, textAlign: "center" }}>phaleṣu</T>
          <T v="headline" style={{ textAlign: "center" }}>
            in the fruits
          </T>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {["root: phala", "noun · neuter", "locative · “in”", "plural"].map((x) => (
              <View key={x} style={[styles.pill, { backgroundColor: c.surface }]}>
                <T v="caption">{x}</T>
              </View>
            ))}
          </View>
        </View>
      </Demo>
      <Tip icon="settings">Word meanings are from Swami Sivananda by default. You can switch to Swami Swarupananda or Swami Mukundananda in Reading settings.</Tip>
    </View>
  );
}

function Commentaries() {
  const { c } = useTheme();
  return (
    <View style={{ gap: 22 }}>
      <Head
        eyebrow="Going deeper"
        title="Translations and commentaries"
        body="Compare every translation side by side, and read the commentaries of the ācāryas — Śaṅkara, Rāmānuja, Madhva and others — in Sanskrit, Hindi and English."
      />
      <Demo style={{ gap: 12 }}>
        <View style={[styles.search, { backgroundColor: c.surface2 }]}>
          <Icon name="search" size={15} color={c.muted} />
          <T v="subhead" muted>
            Search inside the commentaries
          </T>
        </View>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {["All", "Advaita", "Viśiṣṭādvaita", "Dvaita", "Modern"].map((x, k) => (
            <Chip key={x} label={x} small selected={k === 1} tone="surface2" />
          ))}
        </View>
        {[
          ["Śaṅkarācārya", "Sanskrit · Advaita"],
          ["Śaṅkarācārya · English (A. Mahadeva Sastri)", "English · Advaita"],
        ].map(([n, m]) => (
          <View key={n} style={[styles.row, { backgroundColor: c.surface2 }]}>
            <View style={{ flex: 1 }}>
              <T v="subheadStrong" numberOfLines={1}>
                {n}
              </T>
              <T v="caption" muted>
                {m}
              </T>
            </View>
            <Icon name="pinFill" size={15} color={c.accent} />
          </View>
        ))}
      </Demo>
      <View style={{ gap: 12 }}>
        <Tip icon="pin">Pin the commentators you study with — they stay at the top on every verse.</Tip>
        <Tip icon="list">Tap a section heading on the verse page to fold it away if you don’t need it.</Tip>
      </View>
    </View>
  );
}

function Highlight() {
  const { c } = useTheme();
  return (
    <View style={{ gap: 22 }}>
      <Head eyebrow="Making it yours" title="Highlight, note, keep" body="Press and hold on any words in a translation or commentary, drag to choose exactly the words you want, then pick a colour." />
      <Demo style={{ gap: 14 }}>
        <T style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 28, color: c.ink }}>
          Your right is for action alone, <T style={{ fontFamily: fonts.serif, fontSize: 17, backgroundColor: c.dark ? "#5C4B12" : "#FCE8A6" }}>never for the results</T>. Do not become the agent of the results of action.
        </T>
        <View style={[styles.bar, { backgroundColor: c.surface2 }]}>
          {["#FCE8A6", "#D4F0D0", "#DCE6F7", "#F9D6E3"].map((x) => (
            <View key={x} style={[styles.swatch, { backgroundColor: x }]} />
          ))}
          <View style={{ flex: 1 }} />
          {[
            ["note", "Note"],
            ["copy", "Copy"],
            ["share", "Share"],
          ].map(([ic, l]) => (
            <View key={l} style={{ alignItems: "center", gap: 2, paddingHorizontal: 6 }}>
              <Icon name={ic} size={16} color={c.ink} />
              <T v="caption">{l}</T>
            </View>
          ))}
        </View>
      </Demo>
      <View style={{ gap: 12 }}>
        <Tip icon="bookmark">Bookmark verses with the ribbon at the top of a verse page.</Tip>
        <Tip icon="library">Bookmarks, notes, highlights and your reading history all live in the Library tab.</Tip>
      </View>
    </View>
  );
}

function Search() {
  const { c } = useTheme();
  return (
    <View style={{ gap: 22 }}>
      <Head eyebrow="Finding" title="Search the whole Gita" body="One search box covers the verses, every translation, every commentary and the word meanings." />
      <Demo style={{ gap: 10 }}>
        {[
          ["2.47", "jumps straight to a verse"],
          ["karmanye", "romanised, no accents needed"],
          ["कर्मण्ये", "Sanskrit, in any script"],
          ["fruit of action", "phrases in English or Hindi"],
        ].map(([q, d]) => (
          <View key={q} style={[styles.row, { backgroundColor: c.surface2 }]}>
            <Icon name="search" size={15} color={c.muted} />
            <T style={{ ...UI.semibold, fontSize: 15, color: c.ink, minWidth: 110 }}>{q}</T>
            <T v="footnote" muted style={{ flex: 1 }}>
              {d}
            </T>
          </View>
        ))}
      </Demo>
      <Tip icon="chapters">Filter results by chapter, or to just translations, commentaries or word meanings.</Tip>
    </View>
  );
}

function Chant() {
  return (
    <View style={{ gap: 22 }}>
      <Head eyebrow="Reciting" title="Chanting mode" body="Read a whole chapter — or the whole Gita — as one continuous stream of verses, with the current verse lit up. Turn on auto-scroll to read along hands-free." />
      <View style={[styles.demo, { backgroundColor: "#0E0E10", borderColor: "#0E0E10", gap: 18, alignItems: "center", paddingVertical: 24 }]}>
        <T style={{ fontFamily: fonts.sanskrit, fontSize: 16, lineHeight: 28, color: "#8E8A84", textAlign: "center" }}>
          कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।
        </T>
        <T style={{ fontFamily: fonts.sanskrit, fontSize: 19, lineHeight: 32, color: "#FFF8EE", textAlign: "center" }}>
          योगस्थः कुरु कर्माणि सङ्गं त्यक्त्वा धनञ्जय ।
        </T>
        <T style={{ fontFamily: fonts.sanskrit, fontSize: 16, lineHeight: 28, color: "#8E8A84", textAlign: "center" }}>
          दूरेण ह्यवरं कर्म बुद्धियोगाद्धनञ्जय ।
        </T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["This chapter", "Whole Gita"].map((x, k) => (
            <View key={x} style={[styles.pill, { backgroundColor: k ? "#F0A55B" : "rgba(255,255,255,0.1)" }]}>
              <T v="caption" color={k ? "#1A0F05" : "#C9C3B9"}>
                {x}
              </T>
            </View>
          ))}
        </View>
      </View>
      <Tip icon="chant">Start it from the chant card on Today, or “Chant chapter” at the top of any chapter.</Tip>
    </View>
  );
}

function MakeItYours() {
  const dispatch = useDispatch();
  const { c } = useTheme();
  const s = useSelector((st) => st.settings);
  const { data: verse } = useVerse(2, 47);
  const source = s.wordSource || DEFAULT_WORD_SOURCE;
  return (
    <View style={{ gap: 20 }}>
      <Head eyebrow="One last thing" title="Read in your script" body="Choose the script you read Sanskrit in. You can change this, the text size and the theme any time in Reading settings." />
      <Demo style={{ alignItems: "center", paddingVertical: 16 }}>
        {verse ? <Sloka verse={verse} script={s.script} size={18} showIast={false} /> : <View style={{ height: 70 }} />}
      </Demo>
      <View style={styles.grid}>
        {SCRIPTS.map((sc) => {
          const on = s.script === sc.key;
          return (
            <Pressable
              key={sc.key}
              onPress={() => (tap(), dispatch(setSetting({ script: sc.key })))}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={sc.name}
              style={[styles.option, { borderColor: on ? c.accent : c.line, borderWidth: on ? 2 : 1, backgroundColor: on ? c.accentSoft : c.surface }]}
            >
              <T style={{ fontFamily: sc.font, fontSize: 15, lineHeight: 22, color: c.ink }} numberOfLines={1} adjustsFontSizeToFit>
                {sc.label}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={{ gap: 8 }}>
        <T v="footnoteStrong" muted>
          Word meanings from
        </T>
        <Card tone="muted" style={{ padding: 0, overflow: "hidden" }}>
          {availableWordSources().map((src, k, arr) => {
            const on = source === src.key;
            return (
              <Pressable
                key={src.key}
                onPress={() => (tap(), dispatch(setSetting({ wordSource: src.key })))}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.srcRow, k < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}
              >
                <View style={{ flex: 1 }}>
                  <T v="callout">{src.name}</T>
                  <T v="caption" muted numberOfLines={1}>
                    {src.lineage}
                  </T>
                </View>
                {on ? <Icon name="checkCircle" size={19} color={c.accent} /> : null}
              </Pressable>
            );
          })}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, height: 48 },
  page: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  bottom: { paddingHorizontal: 24, gap: 16, paddingTop: 10 },
  dots: { flexDirection: "row", gap: 6, alignSelf: "center" },
  dot: { height: 8, borderRadius: 4 },
  tip: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tipIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  demo: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  swipe: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingHorizontal: 12, height: 30, marginTop: 14 },
  sheet: { borderRadius: 16, padding: 14, gap: 8 },
  pill: { borderRadius: 12, paddingHorizontal: 10, height: 26, justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, height: 40, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 12 },
  bar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 22, paddingHorizontal: 12, height: 52 },
  swatch: { width: 22, height: 22, borderRadius: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { flexBasis: "22%", flexGrow: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  srcRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
});
