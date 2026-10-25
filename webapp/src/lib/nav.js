import { useCallback, useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// ---------------------------------------------------------------- scroll memory
// Each page remembers how far it was scrolled, so coming back to a verse (from a
// commentary, Search, Library…) lands where the reader left it, not at the top.
const SCROLL_KEY = "gita-scroll";
const positions = new Map(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(SCROLL_KEY) || "[]");
    } catch (e) {
      return [];
    }
  })()
);
let persistTimer = null;
// Reading positions (verses, commentaries) are kept across restarts; the newest 300.
function remember(key, top) {
  positions.delete(key);
  positions.set(key, top);
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const keep = [...positions].filter(([k]) => k.startsWith("/verse/")).slice(-300);
      localStorage.setItem(SCROLL_KEY, JSON.stringify(keep));
    } catch (e) {
      // storage full or unavailable: positions still work for this session
    }
  }, 500);
}

/**
 * Remember and restore the scroll position of `ref` (a scrolling element) under `key`.
 * Content loads asynchronously, so the restore keeps re-applying while the page grows,
 * until it reaches the position or the reader scrolls themselves.
 */
export function useScrollMemory(ref, key) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || key == null) return undefined;
    const target = positions.get(key) || 0;
    let restoring = target > 0;
    el.scrollTop = target;
    const stop = () => {
      restoring = false;
    };
    const apply = () => {
      if (!restoring) return;
      el.scrollTop = target;
      if (Math.abs(el.scrollTop - target) < 2) restoring = false;
    };
    const ro = new ResizeObserver(apply);
    for (const child of el.children) ro.observe(child);
    const timer = setTimeout(stop, 2500);
    const save = () => {
      if (!restoring) remember(key, el.scrollTop);
    };
    el.addEventListener("scroll", save, { passive: true });
    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("mousedown", stop);
    window.addEventListener("keydown", stop);
    return () => {
      if (!restoring) remember(key, el.scrollTop);
      ro.disconnect();
      clearTimeout(timer);
      el.removeEventListener("scroll", save);
      el.removeEventListener("wheel", stop);
      el.removeEventListener("mousedown", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [ref, key]);
}

// ---------------------------------------------------------------- where the reader was reading
const READING_KEY = "gita-reading-path";

/** The last verse / commentary / comparison page the reader had open (survives restarts). */
export function readingPath() {
  try {
    return localStorage.getItem(READING_KEY);
  } catch (e) {
    return null;
  }
}

export function useTrackReading(location) {
  useEffect(() => {
    if (/^\/(verse\/\d+\/\d+|read\/\d+)/.test(location.pathname)) {
      try {
        localStorage.setItem(READING_KEY, location.pathname + location.search);
      } catch (e) {
        // private mode: Continue falls back to the last verse in the store
      }
    }
  }, [location.pathname, location.search]);
}

/** Describe a reading path for the sidebar: {label, sub}. */
export function describeReading(path, authorName) {
  const r = (path || "").match(/^\/read\/(\d+)(?:\?v=(\d+))?/);
  if (r) return { ref: `${r[1]}.${r[2] || 1}`, sub: "Reading mode" };
  const m = (path || "").match(/^\/verse\/(\d+)\/(\d+)(?:\/(commentary|translations)(?:\/(\d+))?)?/);
  if (!m) return null;
  const ref = `${m[1]}.${m[2]}`;
  if (m[3] === "commentary") return { ref, sub: m[4] ? `Commentary · ${authorName(Number(m[4]))}` : "Commentaries" };
  if (m[3] === "translations") return { ref, sub: "Comparing translations" };
  return { ref, sub: null };
}

/** True when an overlay (dialog, menu, palette, selection bar) is open and should get Esc first. */
export const overlayOpen = () => !!document.querySelector(".scrim, .popover, .sel-bar");

const editingEl = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Close a detail view (commentary reader, translation comparison) back to its verse:
 * a step back in history when it was opened from that verse (so its scroll position
 * returns too), otherwise straight to the verse. Esc does the same.
 */
export function useCloseToVerse(chapter, verse) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromVerse = !!location.state?.fromVerse;
  const close = useCallback(() => {
    if (fromVerse) navigate(-1);
    else navigate(`/verse/${chapter}/${verse}`);
  }, [fromVerse, navigate, chapter, verse]);
  useEffect(() => {
    const key = (e) => {
      if (e.key !== "Escape" || overlayOpen()) return;
      const el = document.activeElement;
      if (editingEl(el)) {
        el.blur(); // first Esc leaves the field, the next one closes
        return;
      }
      if (window.getSelection()?.toString()) return;
      close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close]);
  return close;
}
