import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowRight, AudioLines, BookOpen, Bookmark, CornerDownLeft, Hash, History, Search, Sun } from "lucide-react";
import { CHAPTERS, VERSE_COUNTS } from "../../../src/lib/names";
import { foldAscii } from "../../../src/gita-data/api";
import { devaDigits } from "../lib/script";

const toAscii = (s) => s.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));

/** ⌘K: jump to a verse or chapter, open a page, or search everything. */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const recent = useSelector((s) => s.settings.recentSearches) || [];
  const last = useSelector((s) => s.progress.last);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef(null);
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo(() => {
    const t = q.trim();
    const a = toAscii(t);
    const out = [];
    const vm = a.match(/^(\d{1,2})\s*[.:,/\s-]\s*(\d{1,3})$/);
    if (vm) {
      const c = Number(vm[1]);
      const v = Number(vm[2]);
      if (c >= 1 && c <= 18 && v >= 1 && v <= VERSE_COUNTS[c]) out.push({ icon: Hash, label: `Go to verse ${c}.${v}`, hint: CHAPTERS[c].name, to: `/verse/${c}/${v}` });
    }
    if (/^\d{1,2}$/.test(a) && Number(a) >= 1 && Number(a) <= 18) {
      const c = Number(a);
      out.push({ icon: BookOpen, label: `Chapter ${c} · ${CHAPTERS[c].name}`, hint: CHAPTERS[c].en, to: `/chapter/${c}` });
    }
    const f = foldAscii(t.toLowerCase()).replace(/\s+/g, "");
    if (f && !/^\d/.test(a)) {
      CHAPTERS.slice(1).forEach((ch, i) => {
        const hay = foldAscii(`${ch.name} ${ch.en}`.toLowerCase()).replace(/\s+/g, "");
        if (hay.includes(f) || ch.sa.includes(t)) out.push({ icon: BookOpen, label: `Chapter ${i + 1} · ${ch.name}`, hint: ch.en, to: `/chapter/${i + 1}` });
      });
    }
    if (t) out.push({ icon: Search, label: `Search for “${t}”`, hint: "Verses, translations, commentaries", to: `/search?q=${encodeURIComponent(t)}` });
    if (!t) {
      if (last) out.push({ icon: ArrowRight, label: `Continue at ${last.chapter}.${last.verse}`, hint: CHAPTERS[last.chapter].name, to: `/verse/${last.chapter}/${last.verse}` });
      out.push({ icon: Sun, label: "Today", to: "/" });
      out.push({ icon: BookOpen, label: "All chapters", to: "/chapters" });
      out.push({ icon: Bookmark, label: "Library", to: "/library" });
      out.push({ icon: AudioLines, label: "Chant", to: `/chant/${last?.chapter || 1}` });
      for (const r of recent.slice(0, 4)) out.push({ icon: History, label: r, hint: "Recent search", to: `/search?q=${encodeURIComponent(r)}` });
    }
    return out.slice(0, 12);
  }, [q, last, recent]);
  useEffect(() => setSel(0), [q]);

  if (!open) return null;
  const go = (it) => {
    if (!it) return;
    onClose();
    navigate(it.to);
  };
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Search or jump to">
        <div className="palette-input">
          <Search size={18} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Verse (2.47), chapter, or anything to search…"
            aria-label="Search or jump to"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((x) => Math.min(items.length - 1, x + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((x) => Math.max(0, x - 1));
              } else if (e.key === "Enter") {
                go(items[sel]);
              } else if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
              }
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list" role="listbox">
          {items.map((it, i) => (
            <button key={i} type="button" role="option" aria-selected={i === sel} className={`palette-item ${i === sel ? "on" : ""}`} onMouseMove={() => setSel(i)} onClick={() => go(it)}>
              <it.icon size={16} strokeWidth={1.75} />
              <span className="ellipsis">{it.label}</span>
              {it.hint ? <span className="palette-hint ellipsis">{it.hint}</span> : null}
              {i === sel ? <CornerDownLeft size={14} className="palette-enter" /> : null}
            </button>
          ))}
        </div>
        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> move
          </span>
          <span>
            <span className="kbd">Enter</span> open
          </span>
          <span className="deva" style={{ marginLeft: "auto", color: "var(--accent)" }}>
            {devaDigits(18)} अध्यायाः · {devaDigits(701)} श्लोकाः
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
