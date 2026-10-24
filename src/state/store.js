import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore, createSlice } from "@reduxjs/toolkit";
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from "redux-persist";
import { scriptKeyFromLegacy } from "../lib/script";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ---------------------------------------------------------------- settings
export const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    script: "dv",
    fontScale: 1,
    theme: "auto", // auto | light | sepia | dark
    showIast: true,
    autoPlayNext: true,
    markReadOnMove: true,
    primaryTranslatorId: 19, // Swami Gambhirananda (Ramakrishna Order, follows Śaṅkara)
    hiddenTranslators: [],
    translatorOrder: [],
    pinnedCommentators: [14, 27, 16],
    commentaryScript: "dv",
    chantScope: "chapter", // chapter | book
    chantShowIast: false,
    chantShowMeaning: false,
    chantRepeat: 1,
    recentSearches: [],
    collapsedSections: {},
    wordSource: "sivananda",
    onboarded: false,
    migratedLegacy: false,
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

// ---------------------------------------------------------------- library
export const librarySlice = createSlice({
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
  },
});

// ---------------------------------------------------------------- progress
export const progressSlice = createSlice({
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
export const { toggleBookmark, setNote, addHighlight, removeHighlight } = librarySlice.actions;
export const { markRead, unmarkRead, setLast } = progressSlice.actions;

const rootReducer = combineReducers({
  settings: settingsSlice.reducer,
  library: librarySlice.reducer,
  progress: progressSlice.reducer,
});

const persisted = persistReducer({ key: "gita-v3", storage: AsyncStorage, version: 1 }, (state, action) => {
  if (action.type === "legacy/import") return applyLegacy(rootReducer(state, action), action.payload);
  return rootReducer(state, action);
});

export const store = configureStore({
  reducer: persisted,
  middleware: (getDefault) =>
    getDefault({ serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] }, immutableCheck: false }),
});

export const persistor = persistStore(store, null, () => importLegacyOnce());

// ---------------------------------------------------------------- migration from app v2 (key "persist:root")
const FONT_SCALES = { Small: 0.9, Medium: 1, Large: 1.15, "Extra Large": 1.3 };

function applyLegacy(state, old) {
  if (!old) return { ...state, settings: { ...state.settings, migratedLegacy: true } };
  const parse = (v) => {
    try {
      return typeof v === "string" ? JSON.parse(v) : v;
    } catch (e) {
      return null;
    }
  };
  const settings = { ...state.settings, migratedLegacy: true };
  const library = { ...state.library, bookmarks: { ...state.library.bookmarks }, notes: { ...state.library.notes } };
  const progress = { ...state.progress };

  const theme = parse(old.theme);
  if (theme && typeof theme.dark === "boolean") settings.theme = theme.dark ? "dark" : "light";
  const fontSize = parse(old.fontSize);
  if (fontSize && FONT_SCALES[fontSize]) settings.fontScale = FONT_SCALES[fontSize];
  const defaults = parse(old.defaults);
  if (defaults) {
    if (defaults.language?.devanagariToLanguage) settings.script = scriptKeyFromLegacy(defaults.language.devanagariToLanguage);
    if (defaults.translation?.id) settings.primaryTranslatorId = defaults.translation.id;
    const commentators = [defaults.commentary?.id, ...(defaults.moreCommentators || []).map((a) => a?.id)].filter(Boolean);
    if (commentators.length) settings.pinnedCommentators = [...new Set(commentators)];
  }
  const favorites = parse(old.favorites) || [];
  for (const f of favorites) {
    if (f && f.chapter_number && f.verse_number) library.bookmarks[`${f.chapter_number}.${f.verse_number}`] = Date.now();
  }
  const notes = parse(old.notes) || {};
  for (const [k, text] of Object.entries(notes)) {
    const [c, v] = k.split(":");
    if (c && v && text) library.notes[`${c}.${v}`] = { text: String(text), updatedAt: Date.now() };
  }
  const sel = parse(old.selectedVerse);
  if (sel && sel.chapter_number) progress.last = { chapter: sel.chapter_number, verse: sel.verse_number, at: Date.now() };
  return { ...state, settings, library, progress };
}

async function importLegacyOnce() {
  if (store.getState().settings.migratedLegacy) return;
  let old = null;
  try {
    const raw = await AsyncStorage.getItem("persist:root");
    old = raw ? JSON.parse(raw) : null;
  } catch (e) {
    old = null;
  }
  store.dispatch({ type: "legacy/import", payload: old });
}
