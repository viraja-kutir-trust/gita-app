import {
  MD3LightTheme as LightTheme,
  MD3DarkTheme as DarkTheme,
  configureFonts,
} from "react-native-paper";

const fontConfig = {
  default: {
    regular: {
      fontFamily: "raleway-regular",
      fontWeight: "normal",
    },
    medium: {
      fontFamily: "sans-serif-medium",
      fontWeight: "normal",
    },
    light: {
      fontFamily: "sans-serif-light",
      fontWeight: "normal",
    },
    thin: {
      fontFamily: "sans-serif-thin",
      fontWeight: "normal",
    },
  },
};
fontConfig.web = fontConfig.default;
fontConfig.ios = fontConfig.default;
fontConfig.android = fontConfig.default;

const commonThemeAspects = (theme) => ({
  roundess: 2,
  version: 3,
  typescale: {
    ...theme.typescale,
    displayLarge: { ...theme.typescale.displayLarge, fontFamily: "readex-pro" },
    displayMedium: {
      ...theme.typescale.displayMedium,
      fontFamily: "readex-pro",
    },
    displaySmall: { ...theme.typescale.displaySmall, fontFamily: "readex-pro" },
    headlineLarge: {
      ...theme.typescale.headlineLarge,
      fontFamily: "readex-pro",
    },
    headlineMedium: {
      ...theme.typescale.headlineMedium,
      fontFamily: "readex-pro",
    },
    headlineSmall: {
      ...theme.typescale.headlineSmall,
      fontFamily: "readex-pro",
    },
    titleLarge: { ...theme.typescale.titleLarge, fontFamily: "readex-pro" },
    titleMedium: { ...theme.typescale.titleMedium, fontFamily: "readex-pro" },
    titleSmall: { ...theme.typescale.titleSmall, fontFamily: "readex-pro" },
    labelLarge: { ...theme.typescale.labelLarge, fontFamily: "readex-pro" },
    labelMedium: { ...theme.typescale.labelMedium, fontFamily: "readex-pro" },
    labelSmall: { ...theme.typescale.labelSmall, fontFamily: "readex-pro" },
    bodyLarge: { ...theme.typescale.bodyLarge, fontFamily: "readex-pro" },
    bodyMedium: { ...theme.typescale.bodyMedium, fontFamily: "readex-pro" },
    bodySmall: { ...theme.typescale.bodySmall, fontFamily: "readex-pro" },
  },
});

export const lightTheme = {
  ...LightTheme,
  ...commonThemeAspects(LightTheme),
};

export const darkTheme = {
  ...DarkTheme,
  ...commonThemeAspects(DarkTheme),
};
