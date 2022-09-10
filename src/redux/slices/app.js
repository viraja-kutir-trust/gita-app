import { createSlice } from "@reduxjs/toolkit";
import { lightTheme } from "../../theme";
import app from "../reducers/app";

export const appSlice = createSlice({
  name: "app",
  initialState: {
    theme: lightTheme,
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
    },
  },
  reducers: app,
});

export const {
  setTheme,
  toggleTheme,
  setVerse,
  setDefaultLanguage,
  setDefaultCommentary,
  setDefaultTranslation,
} = appSlice.actions;

export const selectTheme = (state) => state.app.theme;
export const selectVerse = (state) => state.app.selectedVerse;
export const selectDefaultLanguage = (state) => state.app.defaults.language;
export const selectDefaultTranslation = (state) =>
  state.app.defaults.translation;
export const selectDefaultCommentary = (state) => state.app.defaults.commentary;
