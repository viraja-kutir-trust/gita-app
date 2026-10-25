// Fonts are bundled (the app works offline). Inter and Source Serif 4 are variable
// fonts; the Indic faces come from the phone app's @expo-google-fonts packages.
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/source-serif-4/opsz-italic.css";
import tiro from "@expo-google-fonts/tiro-devanagari-sanskrit/400Regular/TiroDevanagariSanskrit_400Regular.ttf";
import tiroItalic from "@expo-google-fonts/tiro-devanagari-sanskrit/400Regular_Italic/TiroDevanagariSanskrit_400Regular_Italic.ttf";
import telugu from "@expo-google-fonts/noto-serif-telugu/400Regular/NotoSerifTelugu_400Regular.ttf";
import teluguBold from "@expo-google-fonts/noto-serif-telugu/600SemiBold/NotoSerifTelugu_600SemiBold.ttf";
import kannada from "@expo-google-fonts/noto-serif-kannada/400Regular/NotoSerifKannada_400Regular.ttf";
import tamil from "@expo-google-fonts/noto-serif-tamil/400Regular/NotoSerifTamil_400Regular.ttf";
import malayalam from "@expo-google-fonts/noto-serif-malayalam/400Regular/NotoSerifMalayalam_400Regular.ttf";
import bengali from "@expo-google-fonts/noto-serif-bengali/400Regular/NotoSerifBengali_400Regular.ttf";
import gujarati from "@expo-google-fonts/noto-serif-gujarati/400Regular/NotoSerifGujarati_400Regular.ttf";

const faces = [
  ["Tiro Devanagari Sanskrit", tiro, 400],
  ["Tiro Devanagari Sanskrit Italic", tiroItalic, 400],
  ["Noto Serif Telugu", telugu, 400],
  ["Noto Serif Telugu", teluguBold, 600],
  ["Noto Serif Kannada", kannada, 400],
  ["Noto Serif Tamil", tamil, 400],
  ["Noto Serif Malayalam", malayalam, 400],
  ["Noto Serif Bengali", bengali, 400],
  ["Noto Serif Gujarati", gujarati, 400],
];

const style = document.createElement("style");
style.textContent = faces
  .map(([family, url, weight]) => `@font-face{font-family:"${family}";src:url("${url}") format("truetype");font-weight:${weight};font-display:swap;}`)
  .join("\n");
document.head.appendChild(style);
