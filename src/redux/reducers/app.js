const setTheme = (state, action) => {
  state.theme = action.payload;
  return state;
};

const setVerse = (state, action) => {
  state.selectedVerse = action.payload;
  return state;
};

export default {
  setTheme,
  setVerse,
};
