import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { GITA_DB_VERSION, openGitaDb } from "../gita-data/db";
import { DEFAULT_WORD_SOURCE, getWordMeanings } from "../lib/wordMeanings";

// The database opens in the background while the splash screen is up; the
// navigator renders immediately (expo-router requires it) and every query
// simply waits for the database.
let resolveReady;
const readyPromise = new Promise((r) => {
  resolveReady = r;
});
let started = false;

/** Promise for the opened database API. */
export function whenGita() {
  return readyPromise;
}

function start() {
  if (started) return;
  started = true;
  openGitaDb()
    .then((api) => {
      resolveReady(api);
      // Free the space used by older bundled database versions.
      import("expo-sqlite").then((SQLite) => {
        for (let v = 1; v < GITA_DB_VERSION; v++) SQLite.deleteDatabaseAsync(`gita-v${v}.db`).catch(() => {});
      });
    })
    .catch((e) => {
      console.error("Could not open the Gita database", e);
    });
}

const GitaContext = createContext(null);

export function GitaProvider({ children, onReady }) {
  const [api, setApi] = useState(null);
  useEffect(() => {
    start();
    let alive = true;
    readyPromise.then((a) => {
      if (!alive) return;
      setApi(a);
      onReady?.();
    });
    return () => {
      alive = false;
    };
  }, [onReady]);
  return <GitaContext.Provider value={api}>{children}</GitaContext.Provider>;
}

/** The database API, or null for the first moments after launch. */
export function useGita() {
  return useContext(GitaContext);
}

// ---------------------------------------------------------------- tiny query cache
// The database is read-only, so results never go stale: cache them for the
// session and screens re-open instantly without spinners.
const cache = new Map();
const inflight = new Map();

export function prefetch(key, fn) {
  if (cache.has(key) || inflight.has(key)) return inflight.get(key);
  const p = readyPromise
    .then((g) => fn(g))
    .then((v) => {
      cache.set(key, v);
      inflight.delete(key);
      return v;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });
  inflight.set(key, p);
  return p;
}

/** useQuery(key, gita => promise). Returns {data, loading, error}; data is cached by key. */
export function useQuery(key, fn) {
  const [, force] = useState(0);
  const errRef = useRef(null);
  useEffect(() => {
    if (key == null || cache.has(key)) return;
    let alive = true;
    const p = inflight.get(key) || prefetch(key, fn);
    p?.then(() => alive && force((n) => n + 1)).catch((e) => {
      errRef.current = e;
      if (alive) force((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (key == null) return { data: undefined, loading: false, error: null };
  return { data: cache.get(key), loading: !cache.has(key) && !errRef.current, error: errRef.current };
}

// ---------------------------------------------------------------- domain hooks
export const useChapters = () => useQuery("chapters", (g) => g.getChapters());
export const useChapterVerses = (n) => useQuery(n ? `chverses:${n}` : null, (g) => g.getVersesInChapter(n));
export const useVerse = (c, v) => useQuery(c && v ? `verse:${c}.${v}` : null, (g) => g.getVerse(c, v));
export const useAuthors = () => useQuery("authors", (g) => g.getAuthors());
export const useWords = (verseId) => useQuery(verseId ? `words:${verseId}` : null, (g) => g.getWords(verseId));
export const useTexts = (verseId, type) =>
  useQuery(verseId ? `texts:${verseId}:${type}` : null, (g) => g.getTexts(verseId, { type }));
/** Word-by-word for a verse from the reader's chosen source (Settings → Word meanings). */
export function useWordMeanings(verse) {
  const source = useSelector((s) => s.settings.wordSource) || DEFAULT_WORD_SOURCE;
  return useQuery(verse ? `wbw:${source}:${verse.id}` : null, (g) => getWordMeanings(g, source, verse));
}
export const useAudioInfo = (c, v) => useQuery(c && v ? `audio:${c}.${v}` : null, (g) => g.getAudioUrl(c, v));

export function prefetchVerse(_gita, c, v) {
  prefetch(`verse:${c}.${v}`, (g) => g.getVerse(c, v));
}
