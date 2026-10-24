import { createContext, useContext, useMemo } from "react";
import { Platform, useColorScheme } from "react-native";
import { useSelector } from "react-redux";

// One palette per reading theme. Every text/background pair used in the app
// meets WCAG AA (4.5:1) for body text.
const palettes = {
  light: {
    dark: false,
    bg: "#F5F5F7",
    surface: "#FFFFFF",
    surface2: "#F2F2F4",
    surface3: "#E9E9EC",
    ink: "#1C1C1E",
    ink2: "#3A3A3C",
    muted: "#6C6C70",
    line: "#E8E8EC",
    accent: "#A84B0C",
    accentPressed: "#7E380A",
    onAccent: "#FFFFFF",
    accentSoft: "#FBF4EE",
    accentSoft2: "#F7E1CF",
    mark: "#F7E1CF",
    highlight: "#DCE6F7",
    success: "#2E7D4F",
    overlay: "rgba(0,0,0,0.35)",
    glass: "rgba(250,250,252,0.96)",
    glassBorder: "rgba(255,255,255,0.85)",
  },
  sepia: {
    dark: false,
    bg: "#F3EBDD",
    surface: "#FBF6EC",
    surface2: "#EFE4CF",
    surface3: "#E6D8BE",
    ink: "#33281D",
    ink2: "#4E4033",
    muted: "#6B5B49",
    line: "#E3D5BC",
    accent: "#9A4A12",
    accentPressed: "#6E3005",
    onAccent: "#FFFFFF",
    accentSoft: "#F3E2CF",
    accentSoft2: "#EBCFB2",
    mark: "#EBCFB2",
    highlight: "#D9E1EC",
    success: "#2E6B45",
    overlay: "rgba(40,28,15,0.35)",
    glass: "rgba(251,246,236,0.96)",
    glassBorder: "rgba(255,255,255,0.7)",
  },
  dark: {
    dark: true,
    bg: "#0E0E10",
    surface: "#1C1C1E",
    surface2: "#2C2C2E",
    surface3: "#3A3A3C",
    ink: "#F2F2F7",
    ink2: "#D1D1D6",
    muted: "#A1A1A6",
    line: "#2C2C2E",
    accent: "#F0A55B",
    accentPressed: "#F7C48F",
    onAccent: "#1A0F05",
    accentSoft: "#2B1E14",
    accentSoft2: "#4A2E17",
    mark: "#5A3A1C",
    highlight: "#233452",
    success: "#6FCF97",
    overlay: "rgba(0,0,0,0.55)",
    glass: "rgba(38,38,42,0.96)",
    glassBorder: "rgba(255,255,255,0.14)",
  },
};

export const fonts = {
  ui: "Inter_400Regular",
  uiMedium: "Inter_500Medium",
  uiSemibold: "Inter_600SemiBold",
  uiBold: "Inter_700Bold",
  sanskrit: "TiroDevanagariSanskrit_400Regular",
  sanskritItalic: "TiroDevanagariSanskrit_400Regular_Italic",
  serif: "NotoSerif_400Regular",
  serifItalic: "NotoSerif_400Regular_Italic",
};

// Interface text: SF Pro (system) on iOS, Inter elsewhere. Spread into styles: { ...UI.semibold }.
const sys = Platform.OS === "ios";
export const UI = {
  regular: sys ? { fontWeight: "400" } : { fontFamily: fonts.ui },
  medium: sys ? { fontWeight: "500" } : { fontFamily: fonts.uiMedium },
  semibold: sys ? { fontWeight: "600" } : { fontFamily: fonts.uiSemibold },
  bold: sys ? { fontWeight: "700" } : { fontFamily: fonts.uiBold },
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const space = (n) => n * 4;

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const pref = useSelector((s) => s.settings.theme);
  const fontScale = useSelector((s) => s.settings.fontScale);
  const system = useColorScheme();
  const value = useMemo(() => {
    const name = pref === "auto" ? (system === "dark" ? "dark" : "light") : pref;
    return { name, c: palettes[name] || palettes.light, fontScale, isIOS: Platform.OS === "ios" };
  }, [pref, system, fontScale]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
