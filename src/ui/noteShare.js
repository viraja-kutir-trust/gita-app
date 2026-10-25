import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSelector } from "react-redux";
import { useVerse } from "../data/gita";
import { CHAPTERS, parseVerseKey } from "../lib/names";
import { toScript } from "../lib/script";
import { thud } from "./components";

/**
 * What follows a shared note: the verse reference and the sloka itself, in the
 * reader's script, so a friend on WhatsApp sees which verse it is about.
 */
export function noteCite(key, verse, script) {
  const { chapter } = parseVerseKey(key);
  const ref = `— Bhagavad Gita ${key} · ${CHAPTERS[chapter]?.name || ""}`.trim();
  if (!verse) return ref;
  const lines = script === "ro" ? verse.iastLines.map((l) => l.replace(/\|\|/g, "॥").replace(/\|/g, "।")) : verse.lines.map((l) => toScript(l, script));
  return `${ref}\n\n${lines.map((l) => l.trim()).filter(Boolean).join("\n")}`;
}

export function noteMessage(key, text, verse, script) {
  return `${(text || "").trim()}\n\n${noteCite(key, verse, script)}`.trim();
}

/** Copy and share for the note on verse `key` (text passed at call time, so unsaved edits go too). */
export function useNoteShare(key) {
  const script = useSelector((s) => s.settings.script);
  const { chapter, verse } = parseVerseKey(key);
  const { data: v } = useVerse(chapter, verse);
  return {
    cite: noteCite(key, v, script),
    copy: (text) => {
      Clipboard.setStringAsync(noteMessage(key, text, v, script));
      thud();
    },
    share: (text) => Share.share({ message: noteMessage(key, text, v, script) }),
  };
}
