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
        !state.defaults.moreTranslators?.find(
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
        !state.defaults.moreCommentators?.find(
          (commentator) => author.id === commentator.id
        )
      ) {
        tempCommentators.push(author);
      }
    });
  }
  state.defaults.moreCommentators = tempCommentators;
};

const addOrRemoveFavorite = (state, action) => {
  const allFavorites = [...(state.favorites || [])];
  const {
    payload: { type, verse },
  } = action;
  if (type === "add") {
    if (
      !allFavorites?.find((sloka) => sloka && verse && sloka.id === verse.id)
    ) {
      allFavorites.push(verse);
      allFavorites.sort((a, b) => a && b && a.id - b.id);
    }
  } else if (type === "remove") {
    const index = allFavorites.findIndex(
      (sloka) => sloka && verse && sloka.id === verse.id
    );
    allFavorites.splice(index, 1);
  }
  state.favorites = allFavorites;
};

const modifyNote = (state, action) => {
  const currentNotes = { ...state.notes };
  const {
    payload: { type, verse, note },
  } = action;
  if (type === "remove" || !note) {
    delete currentNotes[`${verse.chapter_number}:${verse.verse_number}`];
  } else {
    currentNotes[`${verse.chapter_number}:${verse.verse_number}`] = note;
  }
  state.notes = currentNotes;
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
  addOrRemoveFavorite,
  modifyNote,
};
