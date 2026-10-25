import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { fonts, UI } from "./theme";
import { launchLine } from "../lib/lines";

// Must match the native splash in app.json (expo-splash-screen plugin) so the
// hand-off is seamless: same background, same feather size and position.
const BG = { light: "#FBF7F1", dark: "#0E0E10" };
const FEATHER = 170;


/**
 * Launch screen shown over the app while saved settings and the database load.
 * The feather settles, the title and a line of the Gita appear, then it fades
 * into Today. It stays at least `minMs` so the line can be read; tapping the
 * line opens its verse (`onOpen`), tapping anywhere else skips ahead once ready.
 */
export default function Intro({ ready, onReveal, onDone, onOpen, minMs = 4500 }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const dark = scheme === "dark";
  const line = useRef(launchLine()).current; // the same verse Today opens with
  const t0 = useRef(Date.now()).current;
  const [slow, setSlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [rush, setRush] = useState(false); // the reader tapped: go as soon as the app is ready
  const [reduce, setReduce] = useState(false);

  const lift = useRef(new Animated.Value(0)).current; // feather moves up + shrinks
  const sway = useRef(new Animated.Value(0)).current; // gentle feather sway
  const title = useRef(new Animated.Value(0)).current;
  const verse = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const t = setTimeout(() => setSlow(true), 2200);
    return () => clearTimeout(t);
  }, []);

  const onLayout = () => {
    SplashScreen.hideAsync().catch(() => {});
    const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(lift, { toValue: 1, duration: 650, easing: ease, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(sway, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(sway, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([Animated.delay(260), Animated.timing(title, { toValue: 1, duration: 520, easing: ease, useNativeDriver: true })]),
        Animated.sequence([Animated.delay(560), Animated.timing(verse, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true })]),
      ]),
    ]).start();
  };

  useEffect(() => {
    if (!ready) return;
    const wait = rush ? 0 : Math.max(0, minMs - (Date.now() - t0));
    const t = setTimeout(() => {
      setLeaving(true);
      onReveal?.();
      Animated.timing(out, { toValue: 0, duration: reduce ? 150 : 520, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onDone?.());
    }, wait);
    return () => clearTimeout(t);
  }, [ready, rush]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLine = () => {
    if (leaving) return;
    onOpen?.(line.ref);
    setRush(true);
  };

  const r = (v, a, b) => (reduce ? b : v.interpolate({ inputRange: [0, 1], outputRange: [a, b] }));
  const accent = dark ? "#F0A55B" : "#A84B0C";
  const ink = dark ? "#F2EDE4" : "#2B2118";
  const muted = dark ? "#A29D95" : "#7A6E62";

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents={leaving ? "none" : "auto"}
      style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: BG[scheme], opacity: out }]}
      accessibilityRole="header"
      accessibilityLabel="Srimad Bhagavad Gita"
    >
      <Animated.Image
        source={require("../../assets/splash-feather.png")}
        resizeMode="contain"
        style={{
          width: FEATHER,
          height: FEATHER,
          transform: [
            { translateY: r(lift, 0, -92) },
            { scale: r(lift, 1, 0.84) },
            { rotate: reduce ? "0deg" : sway.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-6deg"] }) },
          ],
        }}
      />
      <Animated.View style={[styles.text, { opacity: title, transform: [{ translateY: r(title, 14, 0) }] }]}>
        <Text style={[styles.title, { color: accent, fontFamily: fonts.sanskrit }]} allowFontScaling={false}>
          श्रीमद्भगवद्गीता
        </Text>
        <Text style={[styles.eyebrow, UI.semibold, { color: muted }]} allowFontScaling={false}>
          GITA ALL-IN-ONE
        </Text>
      </Animated.View>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => !leaving && setRush(true)} accessibilityLabel="Skip" />
      <Animated.View style={[styles.verse, { opacity: verse, transform: [{ translateY: r(verse, 10, 0) }] }]}>
        <Pressable onPress={openLine} accessibilityRole="button" accessibilityLabel={`${line.en}, verse ${line.ref}. Opens the verse.`} style={styles.versePress}>
          <View style={[styles.rule, { backgroundColor: accent }]} />
          <Text style={[styles.sa, { color: ink, fontFamily: fonts.sanskrit }]} allowFontScaling={false}>
            {line.sa}
          </Text>
          <Text style={[styles.en, { color: muted, fontFamily: fonts.serifItalic }]} allowFontScaling={false}>
            {line.en} · {line.ref}
          </Text>
          <Text style={[styles.hint, UI.semibold, { color: accent }]} allowFontScaling={false}>
            Tap to read this verse
          </Text>
        </Pressable>
      </Animated.View>
      {slow && !ready ? (
        <Text style={[styles.slow, UI.regular, { color: muted }]} allowFontScaling={false}>
          Preparing all verses and their commentaries…
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", zIndex: 1000, elevation: 1000 },
  text: { position: "absolute", top: "50%", marginTop: 14, alignItems: "center", gap: 6 },
  title: { fontSize: 36, lineHeight: 52 },
  eyebrow: { fontSize: 12, letterSpacing: 2.4 },
  verse: { position: "absolute", top: "50%", marginTop: 122, left: 0, right: 0, alignItems: "center", paddingHorizontal: 32 },
  versePress: { alignItems: "center", gap: 6, paddingVertical: 8 },
  hint: { fontSize: 12, marginTop: 8, opacity: 0.8 },
  rule: { width: 28, height: 2, borderRadius: 1, marginBottom: 10, opacity: 0.6 },
  sa: { fontSize: 20, lineHeight: 32, textAlign: "center" },
  en: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  slow: { position: "absolute", bottom: 64, fontSize: 13 },
});
