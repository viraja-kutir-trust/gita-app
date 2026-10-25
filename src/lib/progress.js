import { useMemo } from "react";
import { useSelector } from "react-redux";
import { TOTAL_VERSES, VERSE_COUNTS } from "./names";
import { launchLine } from "./lines";

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Consecutive days with reading, ending today (or yesterday if nothing read yet today). */
export function streak(days) {
  let n = 0;
  const d = new Date();
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (days[dayKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function useProgress() {
  const read = useSelector((s) => s.progress.read);
  const days = useSelector((s) => s.progress.days);
  const last = useSelector((s) => s.progress.last);
  return useMemo(() => {
    const perChapter = new Array(19).fill(0);
    for (const k of Object.keys(read)) {
      const c = Number(k.split(".")[0]);
      if (c >= 1 && c <= 18) perChapter[c]++;
    }
    const total = perChapter.reduce((a, b) => a + b, 0);
    return {
      read,
      last,
      total,
      fraction: total / TOTAL_VERSES,
      perChapter,
      chapterFraction: (c) => perChapter[c] / VERSE_COUNTS[c],
      streak: streak(days),
      isRead: (c, v) => !!read[`${c}.${v}`],
      /** First unread verse at or after the last position, so "Continue" never repeats what was finished. */
      nextUnread(chapter) {
        const c = chapter || last?.chapter || 1;
        const start = chapter ? 1 : last?.verse || 1;
        for (let v = start; v <= VERSE_COUNTS[c]; v++) if (!read[`${c}.${v}`]) return { chapter: c, verse: v };
        for (let v = 1; v < start; v++) if (!read[`${c}.${v}`]) return { chapter: c, verse: v };
        return { chapter: c, verse: chapter ? 1 : last?.verse || 1 };
      },
    };
  }, [read, days, last]);
}

/** Same verse for everyone on a given date. */
/** The verse Today opens with: the verse of the line shown on this launch's splash. */
export function verseOfTheDay() {
  const [chapter, verse] = launchLine().ref.split(".").map(Number);
  return { chapter, verse };
}
