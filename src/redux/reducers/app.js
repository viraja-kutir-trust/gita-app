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
  state.defaults.translation = action.payload;
  return state;
};

const setDefaultCommentary = (state, action) => {
  state.defaults.commentary = action.payload;
  return state;
};

const setMoreDefaultTranslators = (state, action) => {
  const tempTranslators = [];
  const { payload } = action;
  if (payload) {
    payload.forEach((author) => {
      if (
        author.id !== state.defaults.translation.id &&
        !state.defaults.moreTranslators.find(
          (translator) => author.id === translator.id
        )
      ) {
        tempTranslators.push(author);
      }
    });
  }
  state.defaults.moreTranslators = tempTranslators;
};

const setMoreDefaultCommentators = (state, action) => {
  const tempCommentators = [];
  const { payload } = action;
  if (payload) {
    payload.forEach((author) => {
      if (
        author.id !== state.defaults.commentary.id &&
        !state.defaults.moreCommentators.find(
          (commentator) => author.id === commentator.id
        )
      ) {
        tempCommentators.push(author);
      }
    });
  }
  state.defaults.moreCommentators = tempCommentators;
};

export default {
  setTheme,
  toggleTheme,
  setVerse,
  setDefaultLanguage,
  setDefaultTranslation,
  setDefaultCommentary,
  setMoreDefaultTranslators,
  setMoreDefaultCommentators,
};
