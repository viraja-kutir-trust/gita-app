import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowRight, AudioLines, Bookmark, Flame, BookOpenCheck, NotebookPen, Type } from "lucide-react";
import Frame from "../components/Frame";
import { Blocks, Sloka } from "../components/reading";
import { Bar, IconButton, MOD, Skeleton } from "../components/ui";
import { useTexts, useVerse } from "../data/gita";
import { useProgress } from "../lib/progress";
import { devaDigits } from "../lib/script";
import { CHAPTERS, VERSE_COUNTS } from "../../../src/lib/names";
import { launchLine } from "../../../src/lib/lines";
import { pickTranslation } from "../../../src/lib/texts";

const DATE_FMT = { weekday: "long", month: "long", day: "numeric" };

export default function Today({ onSettings }) {
  const navigate = useNavigate();
  const s = useSelector((st) => st.settings);
  const notes = useSelector((st) => st.library.notes);
  const bookmarks = useSelector((st) => st.library.bookmarks);
  const progress = useProgress();
  const [vc, vv] = launchLine().ref.split(".").map(Number);
  const { data: verse } = useVerse(vc, vv);
  const { data: texts } = useTexts(verse?.id, "translation");
  const tr = pickTranslation(texts, s.primaryTranslatorId);
  const next = progress.nextUnread();
  const chantChapter = progress.last?.chapter || 12;
  const recentNotes = Object.entries(notes)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <Frame crumbs={[{ label: "Today" }]} actions={<IconButton icon={Type} label="Reading settings" keys={[MOD, ","]} onClick={onSettings} />}>
      <div className="page today">
        <div className="page-head">
          <div>
            <div className="t-eyebrow">{new Date().toLocaleDateString(undefined, DATE_FMT)}</div>
            <h1 className="t-display" style={{ marginTop: 6 }}>
              {greeting}
            </h1>
          </div>
        </div>

        <div className="today-grid">
          <section className="card vod">
            <div className="vod-head">
              <span className="t-eyebrow accent">Verse of the day</span>
              <Link to={`/verse/${vc}/${vv}`} className="t-small muted">
                Chapter {vc} · Verse {vv}
              </Link>
            </div>
            {verse ? <Sloka verse={verse} script={s.script} size={27 * s.fontScale} showIast={false} /> : <Skeleton h={80} />}
            <div className="vod-tr">{tr ? <Blocks blocks={tr.blocks} lang={tr.lang} size={17 * s.fontScale} /> : <Skeleton h={48} />}</div>
            <div className="row" style={{ gap: 10 }}>
              <button type="button" className="btn primary lg" onClick={() => navigate(`/verse/${vc}/${vv}`)}>
                Read with commentary <ArrowRight size={16} />
              </button>
              <span className="t-caption muted">{tr ? `— ${tr.authorName}` : ""}</span>
            </div>
          </section>

          <div className="today-side">
            <Link to={`/verse/${next.chapter}/${next.verse}`} className="card hoverable side-card">
              <div className="t-eyebrow">{progress.last ? "Continue reading" : "Begin reading"}</div>
              <div className="t-heading">
                Chapter {next.chapter} · {CHAPTERS[next.chapter].name}
              </div>
              <div className="t-small muted">{progress.last ? `Next: verse ${next.verse} of ${VERSE_COUNTS[next.chapter]}` : "Start with Arjuna's question at Kurukṣetra"}</div>
              {progress.last ? <Bar value={progress.chapterFraction(next.chapter)} label={`Chapter ${next.chapter} progress`} /> : null}
            </Link>

            <Link to={`/chant/${chantChapter}`} className="card hoverable side-card chant-card">
              <span className="chant-icon">
                <AudioLines size={18} />
              </span>
              <div className="grow">
                <div className="t-strong">Chant chapter {chantChapter}</div>
                <div className="t-small muted ellipsis">
                  {CHAPTERS[chantChapter].name} · {VERSE_COUNTS[chantChapter]} verses
                </div>
              </div>
              <ArrowRight size={16} className="faint" />
            </Link>

            <div className="stats">
              <Link to="/library/history" className="stat">
                <BookOpenCheck size={16} />
                <b className="tnum">{progress.total}</b>
                <span>verses read</span>
              </Link>
              <div className="stat">
                <Flame size={16} />
                <b className="tnum">{progress.streak}</b>
                <span>day streak</span>
              </div>
              <Link to="/library/bookmarks" className="stat">
                <Bookmark size={16} />
                <b className="tnum">{Object.keys(bookmarks).length}</b>
                <span>bookmarks</span>
              </Link>
            </div>

            {recentNotes.length ? (
              <div className="card side-card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="t-eyebrow">Recent notes</span>
                  <Link to="/library/notes" className="link t-caption">
                    All notes
                  </Link>
                </div>
                {recentNotes.map(([k, n]) => (
                  <Link key={k} to={`/verse/${k.replace(".", "/")}`} className="mini-note">
                    <NotebookPen size={14} className="faint" />
                    <span className="grow">
                      <span className="t-caption accent t-strong">{k}</span>
                      <span className="t-small ellipsis" style={{ display: "block" }}>
                        {n.text}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 40 }}>
          <h2>The eighteen chapters</h2>
          <Link to="/chapters" className="link t-small">
            Overview
          </Link>
        </div>
        <div className="ch-grid">
          {CHAPTERS.slice(1).map((ch, i) => {
            const n = i + 1;
            return (
              <Link key={n} to={`/chapter/${n}`} className="card hoverable ch-card">
                <span className="ch-card-num">{devaDigits(n)}</span>
                <span className="t-strong ellipsis">{ch.name}</span>
                <span className="t-caption muted ellipsis">{ch.en}</span>
                <span className="ch-card-foot">
                  <span className="t-caption faint tnum">{VERSE_COUNTS[n]} verses</span>
                  <Bar value={progress.chapterFraction(n)} label={`Chapter ${n} progress`} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}
