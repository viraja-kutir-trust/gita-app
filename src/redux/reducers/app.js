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
  state.defaults.language = { ...state.defaults.language, ...action.payload };
  return state;
};

const setDefaultTranslation = (state, action) => {
  console.log(state.defaults.translation, action.payload);
  state.defaults.translation = action.payload;
  return state;
};

const setDefaultCommentary = (state, action) => {
  console.log(state.defaults.commentary, action.payload);
  state.defaults.commentary = action.payload;
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
