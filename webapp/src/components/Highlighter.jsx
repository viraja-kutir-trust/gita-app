import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Copy, NotebookPen, Search, Share, Trash2 } from "lucide-react";
import { addHighlight, recolorHighlight, removeHighlight, setNote } from "../state/store";
import { copyText, shareText } from "../lib/share";
import { useToast } from "./ui";

export const HL_COLORS = ["yellow", "green", "blue", "pink"];

/**
 * Highlights and selection actions for one text (a translation or commentary).
 * Returns props for <Blocks highlights onSelect> and the floating toolbar element.
 */
export function useHighlighter({ textId, verseKey, authorName, authorId, kind }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const all = useSelector((s) => s.library.highlights);
  const note = useSelector((s) => s.library.notes[verseKey]);
  const highlights = useMemo(() => all.filter((h) => h.textId === textId), [all, textId]);
  const [sel, setSel] = useState(null); // selection or {highlightId, rect}

  const clear = useCallback(() => {
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }, []);
  // A different text: drop this one's pending selection (not the page's — other
  // texts on a Reading-mode page keep loading while the reader selects).
  useEffect(() => setSel(null), [textId]);

  const existing = sel?.highlightId ? highlights.find((h) => h.id === sel.highlightId) : null;
  const quote = existing ? existing.quote : sel?.quote;
  const cite = `— ${authorName}, Bhagavad Gita ${verseKey}`;

  const actions = {
    color(color) {
      if (existing) dispatch(recolorHighlight({ id: existing.id, color }));
      else if (sel?.quote) {
        dispatch(addHighlight({ verseKey, textId, block: sel.block, quote: sel.quote, occurrence: sel.occurrence, color, author: authorName, authorId, kind, snippet: sel.quote.slice(0, 280) }));
      }
      clear();
    },
    remove() {
      if (existing) dispatch(removeHighlight(existing.id));
      clear();
    },
    note() {
      dispatch(setNote({ key: verseKey, text: `${note?.text ? note.text + "\n\n" : ""}“${quote.trim()}” ${cite}` }));
      toast("Added to your note");
      clear();
    },
    async copy() {
      await copyText(`“${quote.trim()}”\n${cite}`);
      toast("Copied");
      clear();
    },
    share() {
      const text = `“${quote.trim()}”\n${cite}`;
      clear();
      shareText(text, toast);
    },
    search() {
      const q = quote.trim().split(/\s+/).slice(0, 6).join(" ");
      clear();
      navigate(`/search?q=${encodeURIComponent(q)}`);
    },
  };

  const toolbar = sel ? <SelectionToolbar rect={sel.rect} existing={existing} actions={actions} onClose={clear} /> : null;
  return { highlights, onSelect: setSel, toolbar };
}

function SelectionToolbar({ rect, existing, actions, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -999, top: -999 });
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth || 320;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
    const top = rect.top - 52 < 60 ? rect.bottom + 10 : rect.top - 52;
    setPos({ left, top });
  }, [rect]);
  useEffect(() => {
    const down = (e) => !ref.current?.contains(e.target) && onClose();
    const key = (e) => e.key === "Escape" && onClose();
    const scroll = () => onClose();
    document.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    document.addEventListener("scroll", scroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
      document.removeEventListener("scroll", scroll, { capture: true });
    };
  }, [onClose]);
  return createPortal(
    <div ref={ref} className="sel-bar" style={pos} role="toolbar" aria-label="Selection" onMouseDown={(e) => e.preventDefault()}>
      <div className="sel-colors">
        {HL_COLORS.map((c) => (
          <button key={c} type="button" className={`sel-dot hl-${c} ${existing?.color === c ? "on" : ""}`} aria-label={`Highlight ${c}`} title={`Highlight ${c}`} onClick={() => actions.color(c)} />
        ))}
      </div>
      <span className="sel-sep" />
      {existing ? (
        <button type="button" className="sel-act" onClick={actions.remove}>
          <Trash2 size={15} strokeWidth={1.75} /> Remove
        </button>
      ) : null}
      <button type="button" className="sel-act" onClick={actions.note}>
        <NotebookPen size={15} strokeWidth={1.75} /> Note
      </button>
      <button type="button" className="sel-act" onClick={actions.copy}>
        <Copy size={15} strokeWidth={1.75} /> Copy
      </button>
      <button type="button" className="sel-act" onClick={actions.share}>
        <Share size={15} strokeWidth={1.75} /> Share
      </button>
      <button type="button" className="sel-act" onClick={actions.search}>
        <Search size={15} strokeWidth={1.75} /> Search
      </button>
    </div>,
    document.body
  );
}
