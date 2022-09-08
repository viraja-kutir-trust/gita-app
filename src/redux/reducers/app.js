import { darkTheme, lightTheme } from "../../theme";

const setTheme = (state, action) => {
  state.theme = action.payload;
  return state;
};

const toggleTheme = (state) => {
  state.theme = state.theme.dark ? lightTheme : darkTheme;
  return state;
};

const setVerse = (state, action) => {
  state.selectedVerse = action.payload;
  return state;
};

const setDefaultLanguage = (state, action) => {
  state.language = { ...state.language, ...action.payload };
  return state;
};

const setDefaultTranslation = (state, action) => {
  state.translation = action.payload;
  return state;
};

const setDefaultCommentary = (state, action) => {
  state.commentary = action.payload;
  return state;
};

export default {
  setTheme,
  toggleTheme,
  setVerse,
  setDefaultLanguage,
  setDefaultTranslation,
  setDefaultCommentary,
};
