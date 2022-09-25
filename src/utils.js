import Sanscript from "@indic-transliteration/sanscript";
import DataAPI from "./gita-data/dataApi";

export function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function transliterate(str, from = "devanagari", to = "telugu") {
  const transliterated = Sanscript.t(str, from, to);
  return transliterated;
}

export function detectNonEnglish(str) {
  const regex = /[\u0900-\u097F]/;
  return regex.test(str);
}

export function detectAndTransliterate(str, to = "telugu") {
  if (!str) {
    return str;
  }
  to = DataAPI.getTransliterationLanguages().find(
    (language) => language.name === to || language.lang === to
  ).lang;

  // Detect parts of str which are devanagari and transliterate them
  const regex = /[\u0900-\u097F]+/g;
  const matches = str?.match(regex);
  if (matches) {
    matches.forEach((match) => {
      const transliterated = Sanscript.t(match, "devanagari", to);
      str = str.replace(match, transliterated);
    });
  }
  return str;
}
