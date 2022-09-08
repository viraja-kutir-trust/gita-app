const fs = require("fs");
const path = require("path");

// // Read verse.json file
// const verses = JSON.parse(fs.readFileSync(path.join(__dirname, "verse.json")));

// // Rearrange the data from verses into chaperId: {verseId: verseText}
// const chapters = verses.reduce((acc, verse) => {
//   if (!acc[verse.chapter_number]) {
//     acc[verse.chapter_number] = {};
//   }
//   acc[verse.chapter_number][verse.verse_number] = verse;
//   return acc;
// }, {});

// // Write the new data to verse-parsed.json
// fs.writeFileSync(
//   path.join(__dirname, "verses-parsed.json"),
//   JSON.stringify(chapters, null, 2)
// );

// Read translation.json file
// const translations = JSON.parse(
//   fs.readFileSync(path.join(__dirname, "translation.json"))
// );

// Rearrange the data from translations into chaperId: {verseId: [translations]}
// const chapters = translations.reduce((acc, translation) => {
//   if (!acc[translation.chapter_number]) {
//     acc[translation.chapter_number] = {};
//   }
//   if (!acc[translation.chapter_number][translation.verse_number]) {
//     acc[translation.chapter_number][translation.verse_number] = [];
//   }
//   acc[translation.chapter_number][translation.verse_number].push(translation);
//   return acc;
// }, {});

// // Write the new data to translations-parsed.json
// fs.writeFileSync(
//   path.join(__dirname, "translations-parsed.json"),
//   JSON.stringify(chapters, null, 2)
// );

// Read all translations and add { type: "translation"} to each translation
// const allTranslations = translations.map((translation) => ({
//   ...translation,
//   type: "translation",
// }));

// // Write the new data to translations-parsed.json
// fs.writeFileSync(
//   path.join(__dirname, "translations-parsed.json"),
//   JSON.stringify(allTranslations, null, 2)
// );

// Read all commentaries and add { type: "commentary"} to each commentary
const commentaries = JSON.parse(
  fs.readFileSync(path.join(__dirname, "commentary.json"))
);

const allCommentaries = commentaries.map((commentary) => ({
  ...commentary,
  type: "commentary",
}));

// Write the new data to commentaries-parsed.json
fs.writeFileSync(
  path.join(__dirname, "commentaries-parsed.json"),
  JSON.stringify(allCommentaries, null, 2)
);
