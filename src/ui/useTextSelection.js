import { useCallback, useMemo, useState } from "react";
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { addHighlight, removeHighlight, setNote } from "../state/store";
import { thud } from "./components";

/**
 * Selection + highlight actions for one text (a translation or commentary).
 * Returns props for <Blocks onSelectText highlights resetKey> and <SelectionBar>.
 */
export default function useTextSelection({ textId, verseKey, authorName, authorId, kind }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const all = useSelector((s) => s.library.highlights);
  const note = useSelector((s) => s.library.notes[verseKey]);
  const highlights = useMemo(() => all.filter((h) => h.textId === textId), [all, textId]);
  const [sel, setSel] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  const clear = useCallback(() => {
    setSel(null);
    setResetKey((k) => k + 1); // remounts the text fields, dropping the native selection
  }, []);

  // An existing highlight the selection touches (to recolour or remove it).
  const existing = useMemo(() => {
    if (!sel) return null;
    return highlights.find((h) => {
      if (h.block !== sel.block) return false;
      if (!h.quote) return true;
      return h.quote.includes(sel.quote) || sel.quote.includes(h.quote);
    });
  }, [sel, highlights]);

  const cite = `— ${authorName}, on Bhagavad Gita ${verseKey}`;

  const bar = {
    visible: !!sel,
    existing,
    onColor: (color) => {
      if (existing) dispatch(removeHighlight(existing.id));
      dispatch(
        addHighlight({
          verseKey,
          textId,
          block: sel.block,
          quote: existing && existing.quote && existing.quote.length > sel.quote.length ? existing.quote : sel.quote,
          occurrence: existing && existing.quote && existing.quote.length > sel.quote.length ? existing.occurrence : sel.occurrence,
          color,
          author: authorName,
          authorId,
          kind,
          snippet: sel.quote.slice(0, 280),
        })
      );
      thud();
      clear();
    },
    onRemove: () => {
      if (existing) dispatch(removeHighlight(existing.id));
      clear();
    },
    onNote: () => {
      dispatch(setNote({ key: verseKey, text: `${note?.text ? note.text + "\n\n" : ""}“${sel.quote.trim()}” ${cite}` }));
      thud();
      clear();
    },
    onCopy: () => {
      Clipboard.setStringAsync(`“${sel.quote.trim()}”\n${cite}`);
      clear();
    },
    onShare: () => {
      const q = sel.quote.trim();
      clear();
      Share.share({ message: `“${q}”\n${cite}` });
    },
    onSearch: () => {
      const q = sel.quote.trim().split(/\s+/).slice(0, 6).join(" ");
      clear();
      router.navigate({ pathname: "/search", params: { q } });
    },
  };

  return { onSelectText: setSel, highlights, resetKey, bar, clear, selection: sel };
}
