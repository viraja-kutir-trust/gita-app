import Sanscript from "@indic-transliteration/sanscript";
import DataAPI from "./gita-data/dataApi";

export function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function transliterate(str, from = "devanagari", to = "telugu") {
  const transliterated = Sanscript.t(str, from, to);
  console.log("Transliterated: ", str, "\n", transliterated);
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
  console.log(str, to);
  to = DataAPI.getTransliterationLanguages().find(
    (language) => language.name === to || language.lang === to
  ).lang;
  console.log(str, to);

  // Detect parts of str which are devanagari and transliterate them
  const regex = /[\u0900-\u097F]+/g;
  const matches = str?.match(regex);
  console.log("Matches: ", matches);
  if (matches) {
    matches.forEach((match) => {
      console.log(match);
      const transliterated = Sanscript.t(match, "devanagari", to);
      str = str.replace(match, transliterated);
    });
  }
  return str;
}
