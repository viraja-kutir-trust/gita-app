const setTheme = (state, action) => {
  state.theme = action.payload;
  return state;
};

export default {
  setTheme,
};
