import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Bookmark, Copy, Download, Highlighter as HighlighterIcon, History, NotebookPen, Trash2 } from "lucide-react";
import Frame from "../components/Frame";
import { Empty, IconButton, useToast } from "../components/ui";
import { useVerse } from "../data/gita";
import { removeHighlight, setNote, toggleBookmark } from "../state/store";
import { useProgress } from "../lib/progress";
import { scriptFont, toScript } from "../lib/script";
import { copyText } from "../lib/share";
import { CHAPTERS, parseVerseKey, VERSE_COUNTS } from "../../../src/lib/names";
import { noteCite } from "../components/StudyPanel";

const TABS = [
  { key: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { key: "notes", label: "Notes", icon: NotebookPen },
  { key: "highlights", label: "Highlights", icon: HighlighterIcon },
  { key: "history", label: "History", icon: History },
];
const byKey = (a, b) => {
  const [ac, av] = a.split(".").map(Number);
  const [bc, bv] = b.split(".").map(Number);
  return ac - bc || av - bv;
};
const when = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function Library() {
  const tab = useParams().tab || "bookmarks";
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const lib = useSelector((s) => s.library);
  const history = useSelector((s) => s.progress.history);
  const progress = useProgress();
  const bookmarks = useMemo(() => Object.keys(lib.bookmarks).sort(byKey), [lib.bookmarks]);
  const notes = useMemo(() => Object.entries(lib.notes).sort((a, b) => b[1].updatedAt - a[1].updatedAt), [lib.notes]);
  const highlights = useMemo(() => lib.highlights.slice().sort((a, b) => b.createdAt - a.createdAt), [lib.highlights]);
  const counts = { bookmarks: bookmarks.length, notes: notes.length, highlights: highlights.length, history: history.length };

  const exportNotes = () => {
    const md = [
      "# My notes — Bhagavad Gita",
      "",
      ...Object.entries(lib.notes)
        .sort((a, b) => byKey(a[0], b[0]))
        .flatMap(([k, n]) => [`## ${k} · ${CHAPTERS[parseVerseKey(k).chapter]?.name || ""}`, "", n.text, ""]),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "gita-notes.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Frame crumbs={[{ label: "Library" }]}>
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="t-display">Library</h1>
            <p>Everything you've kept: bookmarks, notes, highlights and the verses you've read.</p>
          </div>
        </div>

        <section className="card pad progress-card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div className="t-eyebrow">Reading progress</div>
              <div className="t-title tnum" style={{ marginTop: 4 }}>
                {progress.total} <span className="t-body muted" style={{ fontWeight: 450 }}>of 701 verses read</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="t-title tnum accent">{progress.streak}</div>
              <div className="t-caption muted">day streak</div>
            </div>
          </div>
          <div className="progress-bars">
            {CHAPTERS.slice(1).map((ch, i) => {
              const n = i + 1;
              const f = progress.chapterFraction(n);
              return (
                <Link key={n} to={`/chapter/${n}`} className="pbar" title={`Chapter ${n} · ${ch.name}: ${progress.perChapter[n]} of ${VERSE_COUNTS[n]}`}>
                  <span className="pbar-track">
                    <i style={{ height: `${Math.max(f > 0 ? 6 : 0, f * 100)}%` }} />
                  </span>
                  <span className="pbar-n tnum">{n}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="tabs" role="tablist" style={{ margin: "28px 0 16px" }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "on" : ""} onClick={() => navigate(`/library/${t.key}`, { replace: true })}>
              {t.label}
              <span className="n">{counts[t.key]}</span>
            </button>
          ))}
          <span className="grow" />
          {tab === "notes" && notes.length ? (
            <button type="button" className="btn sm ghost" onClick={exportNotes} style={{ alignSelf: "center" }}>
              <Download size={14} /> Export as Markdown
            </button>
          ) : null}
        </div>

        {tab === "bookmarks" &&
          (bookmarks.length ? (
            <div className="list">
              {bookmarks.map((k) => (
                <VerseRow key={k} k={k} meta={`Saved ${when(lib.bookmarks[k])}`} actions={<IconButton icon={Trash2} label="Remove bookmark" className="sm" size={15} onClick={() => dispatch(toggleBookmark(k))} />} />
              ))}
            </div>
          ) : (
            <Empty icon={Bookmark} title="No bookmarks yet">
              Press <span className="kbd">B</span> on any verse, or use the bookmark button at the top.
            </Empty>
          ))}

        {tab === "notes" &&
          (notes.length ? (
            <div className="list">
              {notes.map(([k, n]) => (
                <VerseRow
                  key={k}
                  k={k}
                  text={n.text}
                  meta={`Edited ${when(n.updatedAt)}`}
                  actions={
                    <>
                      <NoteCopy k={k} text={n.text} toast={toast} />
                      <IconButton icon={Trash2} label="Delete note" className="sm" size={15} onClick={() => dispatch(setNote({ key: k, text: "" }))} />
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <Empty icon={NotebookPen} title="No notes yet">
              Open a verse and write in the “Your note” panel (press <span className="kbd">N</span>).
            </Empty>
          ))}

        {tab === "highlights" &&
          (highlights.length ? (
            <div className="list">
              {highlights.map((h) => (
                <Link key={h.id} to={h.kind === "commentary" && h.authorId ? `/verse/${h.verseKey.replace(".", "/")}/commentary/${h.authorId}` : `/verse/${h.verseKey.replace(".", "/")}`} className="list-row hl-row">
                  <span className={`hl-swatch hl-${h.color || "yellow"}`} />
                  <span className="grow">
                    <span className="t-caption muted">
                      <b className="accent">{h.verseKey}</b> · {h.author} · {h.kind === "commentary" ? "commentary" : "translation"} · {when(h.createdAt)}
                    </span>
                    <span className="hl-quote serif">“{h.snippet || h.quote}”</span>
                  </span>
                  <span className="row-actions" onClick={(e) => e.preventDefault()}>
                    <IconButton icon={Trash2} label="Remove highlight" className="sm" size={15} onClick={() => dispatch(removeHighlight(h.id))} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon={HighlighterIcon} title="No highlights yet">
              Select words in any translation or commentary and pick a colour.
            </Empty>
          ))}

        {tab === "history" &&
          (history.length ? (
            <div className="list">
              {history.slice(0, 60).map((k) => (
                <VerseRow key={k} k={k} meta={progress.read[k] ? "Read" : ""} />
              ))}
            </div>
          ) : (
            <Empty icon={History} title="Nothing read yet">
              Verses you open appear here.
            </Empty>
          ))}
      </div>
    </Frame>
  );
}

function NoteCopy({ k, text, toast }) {
  const script = useSelector((s) => s.settings.script);
  const { chapter, verse } = parseVerseKey(k);
  const { data: v } = useVerse(chapter, verse);
  return (
    <IconButton
      icon={Copy}
      label="Copy note with verse"
      className="sm"
      size={15}
      onClick={async () => {
        await copyText(`${text}\n\n${noteCite(k, v, script)}`);
        toast("Copied note with the verse");
      }}
    />
  );
}

function VerseRow({ k, text, meta, actions }) {
  const script = useSelector((s) => s.settings.script);
  const { chapter, verse } = parseVerseKey(k);
  const { data: v } = useVerse(chapter, verse);
  const sc = script === "ro" ? "dv" : script;
  return (
    <Link to={`/verse/${chapter}/${verse}`} className="list-row lib-row">
      <span className="lib-ref tnum">{k}</span>
      <span className="grow">
        <span className="t-caption muted">{CHAPTERS[chapter]?.name}</span>
        {text ? (
          <span className="lib-note">{text}</span>
        ) : (
          <span className="lib-verse ellipsis" style={{ fontFamily: scriptFont(sc) }}>
            {v ? toScript(v.lines[0], sc) : " "}
          </span>
        )}
      </span>
      {meta ? <span className="t-caption faint nowrap">{meta}</span> : null}
      {actions ? (
        <span className="row-actions" onClick={(e) => e.preventDefault()}>
          {actions}
        </span>
      ) : null}
    </Link>
  );
}
