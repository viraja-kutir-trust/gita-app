import { Link, NavLink, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AudioLines, BookOpen, BookOpenText, Bookmark, ScrollText, Info, PanelLeftClose, Search, Settings, Sun } from "lucide-react";
import { authorName, CHAPTERS, VERSE_COUNTS } from "../../../src/lib/names";
import { describeReading, readingPath } from "../lib/nav";
import { devaDigits } from "../lib/script";
import { useProgress } from "../lib/progress";
import { setSetting } from "../state/store";
import { IconButton, Kbd, MOD } from "./ui";

export default function Sidebar({ onSearch, onSettings }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const progress = useProgress();
  const bookmarks = useSelector((s) => Object.keys(s.library.bookmarks).length);
  const notes = useSelector((s) => Object.keys(s.library.notes).length);
  const highlights = useSelector((s) => s.library.highlights.length);
  const m = location.pathname.match(/^\/(?:chapter|verse|chant|read)\/(\d+)/);
  const currentChapter = m ? Number(m[1]) : null;
  const chantChapter = progress.last?.chapter || 1;
  // Where the reader was reading: always one click away, wherever they went since.
  const current = location.pathname + location.search;
  const reading = (/^\/(verse\/\d+\/\d+|read\/\d+)/.test(location.pathname) ? current : readingPath()) || (progress.last ? `/verse/${progress.last.chapter}/${progress.last.verse}` : null);
  const readingInfo = describeReading(reading, (id) => authorName(id, "", "commentary"));
  const here = current === reading;

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sidebar-top">
        <div className="brand">
          <img src="/feather.png" alt="" />
          <div className="grow">
            <div className="brand-name">Gita All-In-One</div>
            <div className="brand-sub">श्रीमद्भगवद्गीता</div>
          </div>
          <IconButton icon={PanelLeftClose} label="Hide sidebar" keys={[MOD, "\\"]} size={16} onClick={() => dispatch(setSetting({ sidebarOpen: false }))} />
        </div>
        <button type="button" className="search-trigger" onClick={onSearch}>
          <Search size={15} strokeWidth={1.75} />
          <span className="grow" style={{ textAlign: "left" }}>
            Search or jump to…
          </span>
          <Kbd>{MOD}</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      <div className="sidebar-scroll">
        {readingInfo ? (
          <Link to={reading} className={`resume ${here ? "here" : ""}`} aria-current={here ? "page" : undefined}>
            <BookOpenText size={16} strokeWidth={1.75} />
            <span className="grow">
              <span className="resume-label">{here ? "Reading" : "Continue reading"}</span>
              <span className="resume-ref ellipsis">
                Verse {readingInfo.ref}
                {readingInfo.sub ? ` · ${readingInfo.sub}` : ` · ${CHAPTERS[Number(readingInfo.ref.split(".")[0])]?.name || ""}`}
              </span>
            </span>
          </Link>
        ) : null}
        <nav className="nav-group" aria-label="Main">
          <NavLink to="/" end className="nav-item">
            <Sun size={16} strokeWidth={1.75} /> Today
          </NavLink>
          <NavLink to="/chapters" className="nav-item">
            <BookOpen size={16} strokeWidth={1.75} /> All chapters
          </NavLink>
          <NavLink to="/search" className="nav-item">
            <Search size={16} strokeWidth={1.75} /> Search
          </NavLink>
          <NavLink to="/library" className="nav-item">
            <Bookmark size={16} strokeWidth={1.75} /> Library
            <span className="count">{bookmarks + notes + highlights || ""}</span>
          </NavLink>
          <NavLink to={`/read/${chantChapter}`} className="nav-item">
            <ScrollText size={16} strokeWidth={1.75} /> Reading mode
          </NavLink>
          <NavLink to={`/chant/${chantChapter}`} className="nav-item">
            <AudioLines size={16} strokeWidth={1.75} /> Chant
          </NavLink>
        </nav>

        <div className="nav-label">
          <span>Chapters</span>
          <span className="tnum">{Math.round(progress.fraction * 100)}% read</span>
        </div>
        <nav className="nav-group" aria-label="Chapters">
          {CHAPTERS.slice(1).map((ch, i) => {
            const n = i + 1;
            const f = progress.chapterFraction(n);
            return (
              <NavLink
                key={n}
                to={`/read/${n}`}
                className={() => `ch-item ${currentChapter === n ? "active" : ""}`}
                title={`Read chapter ${n} · ${ch.name} · ${ch.en} · ${VERSE_COUNTS[n]} verses`}
              >
                <span className="ch-num">{devaDigits(n)}</span>
                <span className="ellipsis">{ch.name}</span>
                <span className="ch-progress" aria-label={`${Math.round(f * 100)}% read`}>
                  <i style={{ width: `${f * 100}%` }} />
                </span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-foot">
        <button type="button" className="nav-item" onClick={onSettings}>
          <Settings size={16} strokeWidth={1.75} /> Settings
          <span className="count">
            <Kbd>{MOD}</Kbd> <Kbd>,</Kbd>
          </span>
        </button>
        <NavLink to="/about" className="nav-item">
          <Info size={16} strokeWidth={1.75} /> Sources & credits
        </NavLink>
      </div>
    </aside>
  );
}
