import { combineReducers, configureStore, createSlice } from "@reduxjs/toolkit";
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from "redux-persist";
import autoMergeLevel2 from "redux-persist/es/stateReconciler/autoMergeLevel2";

// localStorage, as redux-persist's web storage (and AsyncStorage on web) use it.
const storage = {
  getItem: async (k) => localStorage.getItem(k),
  setItem: async (k, v) => localStorage.setItem(k, v),
  removeItem: async (k) => localStorage.removeItem(k),
};

// Same state shape and storage key ("persist:gita-v3") as the phone app's store, so the
// reader's notes, bookmarks, highlights and settings carry over from the earlier desktop
// build (which ran the phone UI in the same app://gita origin).

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    script: "dv",
    fontScale: 1,
    theme: "auto", // auto | light | sepia | dark
    showIast: true,
    autoPlayNext: true,
    markReadOnMove: true,
    primaryTranslatorId: 19, // Swami Gambhirananda
    hiddenTranslators: [],
    translatorOrder: [],
    pinnedCommentators: [14, 27, 16],
    commentaryScript: "dv",
    chantScope: "chapter",
    chantShowIast: false,
    chantShowMeaning: false,
    chantRepeat: 1,
    recentSearches: [],
    collapsedSections: {},
    wordSource: "sivananda",
    showPadaccheda: true,
    teluguScript: "te",
    translateTo: null,
    onboarded: false,
    migratedLegacy: false,
    // desktop only
    panelOpen: true,
    sidebarOpen: true,
    readShow: { sloka: true, padaccheda: true, words: false, translation: true }, // Reading mode
  },
  reducers: {
    setSetting(state, { payload }) {
      Object.assign(state, payload);
    },
    togglePinnedCommentator(state, { payload: id }) {
      const i = state.pinnedCommentators.indexOf(id);
      if (i >= 0) state.pinnedCommentators.splice(i, 1);
      else state.pinnedCommentators.push(id);
    },
    toggleHiddenTranslator(state, { payload: id }) {
      const i = state.hiddenTranslators.indexOf(id);
      if (i >= 0) state.hiddenTranslators.splice(i, 1);
      else state.hiddenTranslators.push(id);
    },
  },
});

const librarySlice = createSlice({
  name: "library",
  initialState: { bookmarks: {}, notes: {}, highlights: [] },
  reducers: {
    toggleBookmark(state, { payload: key }) {
      if (state.bookmarks[key]) delete state.bookmarks[key];
      else state.bookmarks[key] = Date.now();
    },
    setNote(state, { payload: { key, text } }) {
      const t = (text || "").trim();
      if (!t) delete state.notes[key];
      else state.notes[key] = { text: t, updatedAt: Date.now() };
    },
    addHighlight(state, { payload }) {
      state.highlights.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now(), ...payload });
    },
    removeHighlight(state, { payload: id }) {
      state.highlights = state.highlights.filter((h) => h.id !== id);
    },
    recolorHighlight(state, { payload: { id, color } }) {
      const h = state.highlights.find((x) => x.id === id);
      if (h) h.color = color;
    },
  },
});

const progressSlice = createSlice({
  name: "progress",
  initialState: { read: {}, last: null, days: {}, history: [] },
  reducers: {
    markRead(state, { payload: key }) {
      if (!state.read[key]) state.read[key] = Date.now();
      const d = today();
      state.days[d] = (state.days[d] || 0) + 1;
    },
    unmarkRead(state, { payload: key }) {
      delete state.read[key];
    },
    setLast(state, { payload: { chapter, verse } }) {
      state.last = { chapter, verse, at: Date.now() };
      const key = `${chapter}.${verse}`;
      state.history = [key, ...state.history.filter((k) => k !== key)].slice(0, 100);
    },
  },
});

export const { setSetting, togglePinnedCommentator, toggleHiddenTranslator } = settingsSlice.actions;
export const { toggleBookmark, setNote, addHighlight, removeHighlight, recolorHighlight } = librarySlice.actions;
export const { markRead, unmarkRead, setLast } = progressSlice.actions;

const rootReducer = combineReducers({
  settings: settingsSlice.reducer,
  library: librarySlice.reducer,
  progress: progressSlice.reducer,
});

export const store = configureStore({
  reducer: persistReducer({ key: "gita-v3", storage, version: 1, stateReconciler: autoMergeLevel2 }, rootReducer),
  middleware: (getDefault) => getDefault({ serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] }, immutableCheck: false }),
});

export const persistor = persistStore(store);
