import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { openGitaDb } from "./db";
import { DEFAULT_WORD_SOURCE, getWordMeanings } from "../../../src/lib/wordMeanings";

// The database opens once; every query waits for it. It is read-only, so results
// are cached for the session and screens re-open instantly.
let readyPromise = null;
export function whenGita() {
  readyPromise = readyPromise || openGitaDb();
  return readyPromise;
}

const cache = new Map();
const inflight = new Map();

export function prefetch(key, fn) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const p = whenGita()
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

/** useQuery(key, gita => promise) → {data, loading, error}. A null key means "nothing yet". */
export function useQuery(key, fn) {
  const [state, setState] = useState(() => ({ key, data: key != null ? cache.get(key) : undefined, error: null }));
  useEffect(() => {
    if (key == null) return undefined;
    if (cache.has(key)) {
      setState((s) => (s.key === key && s.data === cache.get(key) ? s : { key, data: cache.get(key), error: null }));
      return undefined;
    }
    let alive = true;
    setState({ key, data: undefined, error: null });
    prefetch(key, fn).then(
      (data) => alive && setState({ key, data, error: null }),
      (error) => alive && setState({ key, data: undefined, error })
    );
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (key == null) return { data: undefined, loading: false, error: null };
  const data = state.key === key ? state.data : cache.get(key);
  return { data, loading: data === undefined && !(state.key === key && state.error), error: state.key === key ? state.error : null };
}

export const useChapters = () => useQuery("chapters", (g) => g.getChapters());
export const useChapter = (n) => useQuery(n ? `chapter:${n}` : null, (g) => g.getChapter(n));
export const useChapterVerses = (n) => useQuery(n ? `chverses:${n}` : null, (g) => g.getVersesInChapter(n));
export const useVerse = (c, v) => useQuery(c && v ? `verse:${c}.${v}` : null, (g) => g.getVerse(c, v));
export const useAuthors = () => useQuery("authors", (g) => g.getAuthors());
export const useSources = () => useQuery("sources", (g) => g.getSources());
export const useTexts = (verseId, type) => useQuery(verseId ? `texts:${verseId}:${type}` : null, (g) => g.getTexts(verseId, { type }));
export const useStudyUnits = (verseId) => useQuery(verseId ? `study:${verseId}` : null, (g) => g.getStudyUnits(verseId));

/** Word-by-word for a verse from the reader's chosen source (Settings → Word meanings). */
export function useWordMeanings(verse) {
  const source = useSelector((s) => s.settings.wordSource) || DEFAULT_WORD_SOURCE;
  return useQuery(verse ? `wbw:${source}:${verse.id}` : null, (g) => getWordMeanings(g, source, verse));
}

export function prefetchVerse(c, v) {
  prefetch(`verse:${c}.${v}`, (g) => g.getVerse(c, v)).catch(() => {});
}
