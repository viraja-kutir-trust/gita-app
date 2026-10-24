import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, useColorScheme, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { fonts, UI } from "./theme";

// Must match the native splash in app.json (expo-splash-screen plugin) so the
// hand-off is seamless: same background, same feather size and position.
const BG = { light: "#FBF7F1", dark: "#0E0E10" };
const FEATHER = 170;

// A short line for each day, shown under the title.
const LINES = [
  { sa: "योगः कर्मसु कौशलम्", en: "Yoga is skill in action", ref: "2.50" },
  { sa: "समत्वं योग उच्यते", en: "Evenness of mind is called yoga", ref: "2.48" },
  { sa: "उद्धरेदात्मनात्मानम्", en: "Let one raise oneself by oneself", ref: "6.5" },
  { sa: "न हि ज्ञानेन सदृशं पवित्रमिह विद्यते", en: "Nothing here purifies like knowledge", ref: "4.38" },
  { sa: "योगस्थः कुरु कर्माणि", en: "Established in yoga, do your work", ref: "2.48" },
  { sa: "श्रद्धावान् लभते ज्ञानम्", en: "One full of faith gains knowledge", ref: "4.39" },
  { sa: "मन्मना भव मद्भक्तः", en: "Fix your mind on Me, be devoted to Me", ref: "18.65" },
];

/**
 * Launch screen shown over the app while saved settings and the database load.
 * The feather settles, the title and a line of the Gita appear, then it fades
 * into Today. Never shorter than `minMs`, never longer than needed after `ready`.
 */
export default function Intro({ ready, onReveal, onDone, minMs = 1500 }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const dark = scheme === "dark";
  const line = useRef(LINES[Math.floor(Date.now() / 86400000) % LINES.length]).current;
  const t0 = useRef(Date.now()).current;
  const [slow, setSlow] = useState(false);
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
    const wait = Math.max(0, minMs - (Date.now() - t0));
    const t = setTimeout(() => {
      onReveal?.();
      Animated.timing(out, { toValue: 0, duration: reduce ? 150 : 380, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onDone?.());
    }, reduce ? 0 : wait);
    return () => clearTimeout(t);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = (v, a, b) => (reduce ? b : v.interpolate({ inputRange: [0, 1], outputRange: [a, b] }));
  const accent = dark ? "#F0A55B" : "#A84B0C";
  const ink = dark ? "#F2EDE4" : "#2B2118";
  const muted = dark ? "#A29D95" : "#7A6E62";

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents={ready ? "none" : "auto"}
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
      <Animated.View style={[styles.verse, { opacity: verse, transform: [{ translateY: r(verse, 10, 0) }] }]}>
        <View style={[styles.rule, { backgroundColor: accent }]} />
        <Text style={[styles.sa, { color: ink, fontFamily: fonts.sanskrit }]} allowFontScaling={false}>
          {line.sa}
        </Text>
        <Text style={[styles.en, { color: muted, fontFamily: fonts.serifItalic }]} allowFontScaling={false}>
          {line.en} · {line.ref}
        </Text>
      </Animated.View>
      {slow && !ready ? (
        <Text style={[styles.slow, UI.regular, { color: muted }]} allowFontScaling={false}>
          Preparing 701 verses and their commentaries…
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
  verse: { position: "absolute", top: "50%", marginTop: 122, alignItems: "center", gap: 6, paddingHorizontal: 32 },
  rule: { width: 28, height: 2, borderRadius: 1, marginBottom: 10, opacity: 0.6 },
  sa: { fontSize: 20, lineHeight: 32, textAlign: "center" },
  en: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  slow: { position: "absolute", bottom: 64, fontSize: 13 },
});
