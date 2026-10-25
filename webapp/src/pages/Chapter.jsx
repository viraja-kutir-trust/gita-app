import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowRight, AudioLines, Bookmark, Check, NotebookPen } from "lucide-react";
import Frame from "../components/Frame";
import { Blocks } from "../components/reading";
import { Bar, Segmented, Skeleton } from "../components/ui";
import { useChapter, useChapterVerses } from "../data/gita";
import { useProgress } from "../lib/progress";
import { scriptFont, toScript } from "../lib/script";
import { CHAPTERS, VERSE_COUNTS } from "../../../src/lib/names";

export default function Chapter() {
  const n = Number(useParams().n);
  const navigate = useNavigate();
  const script = useSelector((s) => s.settings.script);
  const bookmarks = useSelector((s) => s.library.bookmarks);
  const notes = useSelector((s) => s.library.notes);
  const progress = useProgress();
  const { data: verses } = useChapterVerses(n);
  const { data: info } = useChapter(n);
  const [summaryLang, setSummaryLang] = useState("en");
  const [showSummary, setShowSummary] = useState(false);
  const meta = CHAPTERS[n];
  if (!meta) return null;
  const read = progress.perChapter[n];
  const next = progress.nextUnread(n);
  const sc = script === "ro" ? "dv" : script;
  const summary = summaryLang === "hi" ? info?.summaryHiBlocks : info?.summaryEnBlocks;

  return (
    <Frame crumbs={[{ label: "Chapters", to: "/chapters" }, { label: `${n} · ${meta.name}` }]}>
      <div className="page narrow">
        <header className="chapter-head">
          <div className="deva accent chapter-sa">{toScript(`${meta.ordinal} · ${meta.sa}`, sc)}</div>
          <h1 className="t-display">{meta.name}</h1>
          <p className="t-heading muted" style={{ fontWeight: 450 }}>
            {meta.en} · {VERSE_COUNTS[n]} verses
          </p>
          <div className="chapter-progress">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="t-small t-strong">
                {read} of {VERSE_COUNTS[n]} read
              </span>
              <span className="t-small muted">{read < VERSE_COUNTS[n] ? `About ${Math.max(1, Math.round((VERSE_COUNTS[n] - read) * 0.3))} min left` : "Completed"}</span>
            </div>
            <Bar value={read / VERSE_COUNTS[n]} label={`Chapter ${n} progress`} />
          </div>
          <div className="row" style={{ gap: 10, marginTop: 18 }}>
            <button type="button" className="btn primary lg" onClick={() => navigate(`/verse/${n}/${next.verse}`)}>
              {read ? `Continue at ${n}.${next.verse}` : "Start reading"} <ArrowRight size={16} />
            </button>
            <button type="button" className="btn lg" onClick={() => navigate(`/chant/${n}`)}>
              <AudioLines size={16} /> Chant this chapter
            </button>
          </div>
        </header>

        {info?.summaryEnBlocks?.length ? (
          <section className="card pad chapter-summary">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <span className="t-eyebrow">Summary</span>
              {info.summaryHiBlocks?.length ? (
                <Segmented
                  value={summaryLang}
                  onChange={setSummaryLang}
                  label="Summary language"
                  options={[
                    { value: "en", label: "English" },
                    { value: "hi", label: "हिन्दी", style: { fontFamily: "var(--font-deva)" } },
                  ]}
                />
              ) : null}
            </div>
            <div className={showSummary ? "" : "clamp"}>
              <Blocks blocks={summary} lang={summaryLang === "hi" ? "hindi" : "english"} size={16} />
            </div>
            <button type="button" className="link t-small" style={{ marginTop: 10 }} onClick={() => setShowSummary((x) => !x)}>
              {showSummary ? "Show less" : "Read the full summary"}
            </button>
          </section>
        ) : null}

        <div className="section-title" style={{ marginTop: 32 }}>
          <h2>Verses</h2>
          <span className="t-caption muted">Click a verse to read it with translations and commentaries</span>
        </div>
        <div className="list">
          {verses
            ? verses.map((v) => {
                const key = `${n}.${v.verse}`;
                const isRead = !!progress.read[key];
                const upNext = v.verse === next.verse && read > 0 && !isRead;
                return (
                  <Link key={v.id} to={`/verse/${n}/${v.verse}`} className={`list-row verse-row ${upNext ? "next" : ""}`}>
                    <span className="verse-row-num tnum">{key}</span>
                    <span className="grow verse-row-text" style={{ fontFamily: script === "ro" ? "var(--font-serif)" : scriptFont(sc), fontStyle: script === "ro" ? "italic" : undefined }}>
                      {script === "ro" ? v.iastLines[0] : toScript(v.lines[0], sc)}
                      <span className="verse-row-2">{script === "ro" ? v.iastLines[1] : toScript(v.lines[1] || "", sc)}</span>
                    </span>
                    <span className="verse-row-icons">
                      {notes[key] ? <NotebookPen size={14} className="faint" aria-label="Has a note" /> : null}
                      {bookmarks[key] ? <Bookmark size={14} className="accent" fill="currentColor" aria-label="Bookmarked" /> : null}
                      {upNext ? <span className="badge">Up next</span> : isRead ? <Check size={15} style={{ color: "var(--success)" }} aria-label="Read" /> : null}
                    </span>
                  </Link>
                );
              })
            : Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="list-row">
                  <Skeleton h={18} />
                </div>
              ))}
        </div>
      </div>
    </Frame>
  );
}
