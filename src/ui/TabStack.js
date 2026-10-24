import { Platform } from "react-native";
import { Stack } from "expo-router";
import { fonts, useTheme, UI } from "./theme";

/** Stack used inside each tab: native large titles that collapse on scroll. */
export default function TabStack({ children }) {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: Platform.OS === "ios",
        headerLargeTitleShadowVisible: false,
        headerTransparent: Platform.OS === "ios",
        headerShadowVisible: false,
        headerTintColor: c.accent,
        headerTitleStyle: Platform.OS === "ios" ? { color: c.ink } : { ...UI.semibold, color: c.ink },
        headerLargeTitleStyle: Platform.OS === "ios" ? { color: c.ink } : { ...UI.bold, color: c.ink },
        headerStyle: Platform.OS === "ios" ? undefined : { backgroundColor: c.bg },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      {children}
    </Stack>
  );
}
