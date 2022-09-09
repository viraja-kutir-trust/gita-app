const DataAPI = {
  getChapters: async function () {
    const chapters = await require("./chapters.json");
    return chapters;
  },
  getVerses: async function () {
    const verses = await require("./verses-parsed.json");
    return verses;
  },
  getVerse: async function (chapterNumber, verseNumber) {
    return (await this.getVerses())[chapterNumber][verseNumber];
  },
  getTranslations: async function () {
    const translations = await require("./translation.json");
    return translations;
  },
  getTranslationByAuthor: async function (verseId, authorId) {
    if (!verseId || !authorId) {
      return null;
    }
    const translations = await require("./translation.json");
    const translation = translations.find(
      (_translation) =>
        _translation.verse_id === verseId && _translation.author_id === authorId
    );
    return translation;
  },
  getAuthors: async function () {
    const authors = await require("./authors.json");
    return authors;
  },
  getTranslators: async function () {
    const translatorsKnown = [
      { authorName: "Swami Ramsukhdas", id: 1, lang: "hindi" },
      { authorName: "Swami Sivananda", id: 16, lang: "english" },
      { authorName: "Swami Gambhiranda", id: 19, lang: "english" },
      { authorName: "Swami Adidevananda", id: 18, lang: "english" },
      { authorName: "Swami Tejomayananda", id: 17, lang: "hindi" },
      { authorName: "Shri Purohit Swami", id: 21, lang: "english" },
      { authorName: "Dr. S. Sankaranarayan", id: 20, lang: "english" },
    ];
    // const authors = await this.getAuthors();
    // const translators = authors.filter((author) =>
    //   translatorsKnown.includes(author.name)
    // );
    return translatorsKnown;
  },
  getCommenters: async function () {
    const commentersKnown = [
      { authorName: "Swami Ramsukhdas", lang: "hindi", id: 1 },
      { authorName: "Swami Chinmayananda", lang: "hindi", id: 2 },
      { authorName: "Sri Anandgiri", lang: "sanskrit", id: 3 },
      { authorName: "Sri Dhanpati", lang: "sanskrit", id: 4 },
      { authorName: "Sri Madhavacharya", lang: "sanskrit", id: 5 },
      { authorName: "Sri Neelkanth", lang: "sanskrit", id: 6 },
      { authorName: "Sri Ramanujacharya", lang: "sanskrit", id: 7 },
      { authorName: "Sri Sridhara Swami", lang: "sanskrit", id: 8 },
      {
        authorName: "Sri Vedantadeshikacharya Venkatanatha",
        lang: "sanskrit",
        id: 9,
      },
      { authorName: "Sri Abhinavgupta", lang: "sanskrit", id: 10 },
      { authorName: "Sri Jayatritha", lang: "sanskrit", id: 11 },
      { authorName: "Sri Madhusudan Saraswati", lang: "sanskrit", id: 12 },
      { authorName: "Sri Purushottamji", lang: "sanskrit", id: 13 },
      { authorName: "Sri Shankaracharya", lang: "sanskrit", id: 14 },
      { authorName: "Sri Vallabhacharya", lang: "sanskrit", id: 15 },
      { authorName: "Swami Sivananda", lang: "english", id: 16 },
    ];
    return commentersKnown;
  },
  getLanguages: async function () {
    const languages = await require("./languages.json");
    return languages;
  },
  getCommentaries: async function () {
    const commentaries = await require("./commentary.json");
    return commentaries;
  },
  getCommentaryByAuthor: async function (verseId, authorId) {
    if (!verseId || !authorId) {
      return null;
    }
    const commentaries = await require("./commentary.json");
    const commentary = commentaries.find(
      (_commentary) =>
        _commentary.verse_id === verseId && _commentary.author_id === authorId
    );
    return commentary;
  },
};

export default DataAPI;
