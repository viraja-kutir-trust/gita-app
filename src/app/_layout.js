import "react-native-gesture-handler";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogBox, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { TiroDevanagariSanskrit_400Regular } from "@expo-google-fonts/tiro-devanagari-sanskrit/400Regular";
import { TiroDevanagariSanskrit_400Regular_Italic } from "@expo-google-fonts/tiro-devanagari-sanskrit/400Regular_Italic";
import { NotoSerif_400Regular } from "@expo-google-fonts/noto-serif/400Regular";
import { NotoSerif_400Regular_Italic } from "@expo-google-fonts/noto-serif/400Regular_Italic";
import { NotoSerifTelugu_400Regular } from "@expo-google-fonts/noto-serif-telugu/400Regular";
import { NotoSerifKannada_400Regular } from "@expo-google-fonts/noto-serif-kannada/400Regular";
import { NotoSerifTamil_400Regular } from "@expo-google-fonts/noto-serif-tamil/400Regular";
import { NotoSerifMalayalam_400Regular } from "@expo-google-fonts/noto-serif-malayalam/400Regular";
import { NotoSerifBengali_400Regular } from "@expo-google-fonts/noto-serif-bengali/400Regular";
import { NotoSerifGujarati_400Regular } from "@expo-google-fonts/noto-serif-gujarati/400Regular";
import { persistor, store } from "../state/store";
import { ThemeProvider, useTheme, fonts, UI } from "../ui/theme";
import { GitaProvider } from "../data/gita";
import { AudioProvider } from "../audio/AudioProvider";
import Intro from "../ui/Intro";

SplashScreen.preventAutoHideAsync().catch(() => {});
// Dev-only noise from native tabs preloading; not shown in production builds.
LogBox.ignoreLogs(["was not handled by any navigator"]);
SplashScreen.setOptions?.({ fade: true, duration: 250 });

export const unstable_settings = { anchor: "(tabs)" };

function Navigator({ revealed }) {
  const { c, name } = useTheme();
  const router = useRouter();
  const onboarded = useSelector((s) => s.settings.onboarded);
  const shown = useRef(false);
  // First launch (and first launch after upgrading to this design): show the tour.
  useEffect(() => {
    if (!revealed || onboarded || shown.current) return;
    shown.current = true;
    // Opens without animation underneath the fading intro, so the intro dissolves straight into the tour.
    router.push("/welcome");
  }, [revealed, onboarded, router]);
  const header = {
    headerTintColor: c.accent,
    headerTitleStyle: Platform.OS === "ios" ? { color: c.ink } : { ...UI.semibold, color: c.ink },
    headerLargeTitleStyle: Platform.OS === "ios" ? { color: c.ink } : { ...UI.bold, color: c.ink },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: c.bg },
    headerStyle: { backgroundColor: c.bg },
  };
  const sheet = {
    presentation: "formSheet",
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    headerShown: false,
    contentStyle: { backgroundColor: c.surface },
  };
  return (
    <>
      <StatusBar style={name === "dark" ? "light" : "dark"} />
      <Stack screenOptions={header}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="verse/[chapter]/[verse]" options={{ title: "", headerTransparent: false }} />
        <Stack.Screen name="commentaries/[chapter]/[verse]" options={{ title: "Commentaries" }} />
        <Stack.Screen name="commentary/[chapter]/[verse]/[author]" options={{ title: "" }} />
        <Stack.Screen name="compare/[chapter]/[verse]" options={{ title: "Translations" }} />
        <Stack.Screen name="word/[chapter]/[verse]/[idx]" options={{ ...sheet, sheetAllowedDetents: [0.62, 1] }} />
        <Stack.Screen name="settings" options={{ ...sheet, sheetAllowedDetents: [0.92] }} />
        <Stack.Screen name="note/[chapter]/[verse]" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="chant" options={{ headerShown: false, presentation: "fullScreenModal", contentStyle: { backgroundColor: "#0E0E10" } }} />
        <Stack.Screen name="about" options={{ title: "Sources & credits" }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, presentation: "fullScreenModal", gestureEnabled: false, animation: "none" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    TiroDevanagariSanskrit_400Regular,
    TiroDevanagariSanskrit_400Regular_Italic,
    NotoSerif_400Regular,
    NotoSerif_400Regular_Italic,
    NotoSerifTelugu_400Regular,
    NotoSerifKannada_400Regular,
    NotoSerifTamil_400Regular,
    NotoSerifMalayalam_400Regular,
    NotoSerifBengali_400Regular,
    NotoSerifGujarati_400Regular,
  });
  const [dbReady, setDbReady] = useState(false);
  const [hydrated, setHydrated] = useState(persistor.getState().bootstrapped);
  const onDbReady = useCallback(() => setDbReady(true), []);

  useEffect(() => {
    if (hydrated) return;
    return persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) setHydrated(true);
    });
  }, [hydrated]);

  const [introDone, setIntroDone] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Fonts gate the first render (expo's documented pattern) so no text is ever drawn
  // with a fallback font. Then the animated Intro takes over from the native splash
  // and covers the app until saved settings and the database are ready.
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <ThemeProvider>
            <GitaProvider onReady={onDbReady}>
              <AudioProvider>
                <Navigator revealed={revealed} />
              </AudioProvider>
              {introDone ? null : <Intro ready={dbReady && hydrated} onReveal={() => setRevealed(true)} onDone={() => setIntroDone(true)} />}
            </GitaProvider>
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
