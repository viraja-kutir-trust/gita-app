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

const commonThemeAspects = (theme) => {
  return {
    roundess: 2,
    version: 3,
    fonts: {
      ...theme.fonts,
      displayLarge: {
        ...theme.fonts.displayLarge,
        fontFamily: "readex-pro",
      },
      displayMedium: {
        ...theme.fonts.displayMedium,
        fontFamily: "readex-pro",
      },
      displaySmall: {
        ...theme.fonts.displaySmall,
        fontFamily: "readex-pro",
      },
      headlineLarge: {
        ...theme.fonts.headlineLarge,
        fontFamily: "readex-pro",
      },
      headlineMedium: {
        ...theme.fonts.headlineMedium,
        fontFamily: "readex-pro",
      },
      headlineSmall: {
        ...theme.fonts.headlineSmall,
        fontFamily: "readex-pro",
      },
      titleLarge: { ...theme.fonts.titleLarge, fontFamily: "readex-pro" },
      titleMedium: { ...theme.fonts.titleMedium, fontFamily: "readex-pro" },
      titleSmall: { ...theme.fonts.titleSmall, fontFamily: "readex-pro" },
      labelLarge: { ...theme.fonts.labelLarge, fontFamily: "readex-pro" },
      labelMedium: { ...theme.fonts.labelMedium, fontFamily: "readex-pro" },
      labelSmall: { ...theme.fonts.labelSmall, fontFamily: "readex-pro" },
      bodyLarge: { ...theme.fonts.bodyLarge, fontFamily: "readex-pro" },
      bodyMedium: { ...theme.fonts.bodyMedium, fontFamily: "readex-pro" },
      bodySmall: { ...theme.fonts.bodySmall, fontFamily: "readex-pro" },
    },
  };
};

export const lightTheme = {
  ...LightTheme,
  ...commonThemeAspects(LightTheme),
};

export const darkTheme = {
  ...DarkTheme,
  ...commonThemeAspects(DarkTheme),
};
