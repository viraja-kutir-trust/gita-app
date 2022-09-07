const DataAPI = {
  getChapters: async function () {
    const chapters = await require("./chapters.json");
    return chapters;
  },
  getVerses: async function () {
    const verses = await require("./verses-parsed.json");
    return verses;
  },
  getTranslations: async function () {
    const translations = await require("./translation.json");
    return translations;
  },
  getAuthors: async function () {
    const authors = await require("./authors.json");
    return authors;
  },
  getLanguages: async function () {
    const languages = await require("./languages.json");
    return languages;
  },
  getCommentaries: async function () {
    const commentaries = await require("./commentary.json");
    return commentaries;
  },
};

export default DataAPI;
