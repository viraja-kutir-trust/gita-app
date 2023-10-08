import { createSlice } from "@reduxjs/toolkit";
import { lightTheme } from "../../theme";
import app from "../reducers/app";

export const appSlice = createSlice({
  name: "app",
  initialState: {
    theme: lightTheme,
    fontSize: "Medium",
    selectedVerse: null,
    defaults: {
      language: {
        devanagariToLanguage: "Devanagari",
        transliteration: "English",
        meaning: "English",
        commentary: "English",
      },
      translation: { authorName: "Swami Gambhiranda", id: 19, lang: "english" },
      commentary: { authorName: "Swami Sivananda", lang: "english", id: 16 },
      moreTranslators: [],
      moreCommentators: [],
    },
    favorites: [],
    notes: {},
  },
  reducers: app,
});

export const {
  setTheme,
  toggleTheme,
  setFontSize,
  setVerse,
  setDefaultLanguage,
  setDefaultCommentary,
  setDefaultTranslation,
  setMoreDefaultCommentators,
  setMoreDefaultTranslators,
  addOrRemoveFavorite,
  modifyNote,
} = appSlice.actions;

export const selectTheme = (state) => state.app.theme;
export const selectVerse = (state) => state.app.selectedVerse;
export const selectFontSize = (state) => state.app.fontSize;
export const selectDefaultLanguage = (state) => state.app.defaults.language;
export const selectDefaultTranslation = (state) =>
  state.app.defaults.translation;
export const selectDefaultCommentary = (state) => state.app.defaults.commentary;
export const selectMoreTranslators = (state) =>
  state.app.defaults.moreTranslators;
export const selectMoreCommentators = (state) =>
  state.app.defaults.moreCommentators;
export const selectFavorites = (state) => state.app.favorites;
export const selectNotes = (state) => state.app.notes;
