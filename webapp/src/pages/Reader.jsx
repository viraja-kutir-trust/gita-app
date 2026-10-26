import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Bookmark, BookmarkCheck, Copy, ExternalLink, MoreHorizontal, NotebookPen, Type } from "lucide-react";
import Frame from "../components/Frame";
import { Blocks, Sloka } from "../components/reading";
import { IconButton, Menu, MOD, Skeleton, useToast, ViewSwitch } from "../components/ui";
import { useChapterVerses, useStudyUnits, useTexts, useWordMeanings } from "../data/gita";
import { setLast, setSetting, toggleBookmark } from "../state/store";
import { Padaccheda } from "./Verse";
import { AddNote, NoteCard, NoteDialog } from "../components/Notes";
import { useHighlighter } from "../components/Highlighter";
import { fromTelugu, scriptFont, toScript, verseLines } from "../lib/script";
import { NOTE } from "../lib/study";
import { copyText } from "../lib/share";
import { authorName, CHAPTERS, VERSE_COUNTS } from "../../../src/lib/names";
import { pickTranslation } from "../../../src/lib/texts";

const PARTS = [
  { key: "sloka", label: "Sloka" },
  { key: "padaccheda", label: "Padaccheda" },
  { key: "words", label: "Word by word" },
  { key: "translation", label: "Translation" },
];

/**
 * Reading mode: the whole Gita as one continuous page. Starts at a chapter (or a
 * verse, ?v=) and loads the chapters before and after as the reader scrolls.
 * The URL follows the verse being read, so Back and "Continue reading" return to it.
 */
export default function Reader({ onSettings }) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const s = useSelector((st) => st.settings);
  const show = { sloka: true, padaccheda: true, words: false, translation: true, ...s.readShow };
  const startChapter = Math.min(18, Math.max(1, Number(params.chapter) || 1));
  const startVerse = Number(new URLSearchParams(location.search).get("v")) || 1;
  const [range, setRange] = useState({ lo: startChapter, hi: startChapter });
  const [focus, setFocus] = useState({ chapter: startChapter, verse: startVerse });
  const scroller = useRef(null);
  const ownUrl = useRef(null); // the URL this page set itself while scrolling
  const pendingJump = useRef({ chapter: startChapter, verse: startVerse });
  const [epoch, setEpoch] = useState(0); // bumps after a jump, so loading resumes from there

  // A chapter picked in the sidebar (or a link): jump there, unless the URL is our own.
  useEffect(() => {
    const here = location.pathname + location.search;
    if (ownUrl.current === here) return;
    const c = startChapter;
    const v = startVerse;
    pendingJump.current = { chapter: c, verse: v };
    setRange((r) => (c >= r.lo && c <= r.hi ? r : { lo: c, hi: c }));
    setFocus({ chapter: c, verse: v });
    tryJump();
  }, [location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to the pending verse once it is on the page.
  const tryJump = useCallback(() => {
    const j = pendingJump.current;
    const box = scroller.current;
    if (!j || !box) {
      setTimeout(() => extendRef.current(), 200);
      return;
    }
    const sel = j.verse > 1 ? `[data-key="${j.chapter}.${j.verse}"]` : `[data-chapter-head="${j.chapter}"]`;
    const el = box.querySelector(sel);
    if (!el) return;
    box.scrollTop = el.offsetTop - (j.verse > 1 ? 24 : 8);
    pendingJump.current = null;
    setEpoch((n) => n + 1);
  }, []);

  // Which verse is being read: the first one whose bottom is below the top band.
  const raf = useRef(0);
  const extendRef = useRef(() => {});
  const onScroll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const box = scroller.current;
      if (!box || pendingJump.current) return;
      extendRef.current();
      const line = box.scrollTop + 140;
      for (const el of box.querySelectorAll("[data-key]")) {
        if (el.offsetTop + el.offsetHeight > line) {
          const [c, v] = el.dataset.key.split(".").map(Number);
          setFocus((f) => (f.chapter === c && f.verse === v ? f : { chapter: c, verse: v }));
          break;
        }
      }
    });
  }, []);

  // Follow the focus: URL (replace) and last position.
  useEffect(() => {
    const t = setTimeout(() => {
      const url = `/read/${focus.chapter}${focus.verse > 1 ? `?v=${focus.verse}` : ""}`;
      if (location.pathname + location.search !== url) {
        ownUrl.current = url;
        navigate(url, { replace: true });
      }
      dispatch(setLast(focus));
    }, 350);
    // Scrolling past a verse doesn't mark it read here; only the verse page does.
    return () => clearTimeout(t);
  }, [focus.chapter, focus.verse]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the neighbouring chapters when the reader nears either end. A chapter added
  // above keeps the verse on screen where it was (the page grows upwards).
  const anchor = useRef(null);
  const extend = useCallback(() => {
    const box = scroller.current;
    // Wait for chapters still loading (their height isn't known yet).
    if (!box || pendingJump.current || anchor.current || box.querySelector(".rd-chapter .skeleton")) return;
    const below = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (below < 1600) setRange((r) => (r.hi < 18 ? { ...r, hi: r.hi + 1 } : r));
    if (box.scrollTop < 1600) {
      setRange((r) => {
        if (r.lo <= 1) return r;
        const el = [...box.querySelectorAll("[data-key],[data-chapter-head]")].find((e) => e.offsetTop + e.offsetHeight > box.scrollTop);
        if (el) anchor.current = { sel: el.dataset.key ? `[data-key="${el.dataset.key}"]` : `[data-chapter-head="${el.dataset.chapterHead}"]`, delta: el.offsetTop - box.scrollTop };
        return { ...r, lo: r.lo - 1 };
      });
    }
  }, []);
  extendRef.current = extend;
  useLayoutEffect(() => {
    const box = scroller.current;
    const a = anchor.current;
    if (box && a) {
      const el = box.querySelector(a.sel);
      if (el) box.scrollTop = el.offsetTop - a.delta;
      anchor.current = null;
    }
    const t = setTimeout(extend, 200);
    return () => clearTimeout(t);
  }, [range.lo, range.hi, epoch, extend]);

  const toggle = (k) => {
    const next = { ...show, [k]: !show[k] };
    if (!PARTS.some((p) => next[p.key])) return; // keep at least one part
    dispatch(setSetting({ readShow: next }));
  };
  const chapters = [];
  for (let c = range.lo; c <= range.hi; c++) chapters.push(c);
  const meta = CHAPTERS[focus.chapter];

  return (
    <Frame
      crumbs={[{ label: "Reading" }, { label: `Chapter ${focus.chapter} · ${meta.name}` }, { label: `Verse ${focus.verse} of ${VERSE_COUNTS[focus.chapter]}` }]}
      actions={
        <>
          <ViewSwitch chapter={focus.chapter} verse={focus.verse} current="read" onNavigate={navigate} />
          <span className="divider" />
          <div className="rd-toggles" role="group" aria-label="Show">
            {PARTS.map((p) => (
              <button key={p.key} type="button" className={`rd-toggle ${show[p.key] ? "on" : ""}`} aria-pressed={show[p.key]} onClick={() => toggle(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
          <IconButton icon={Type} label="Reading settings" keys={[MOD, ","]} onClick={onSettings} />
        </>
      }
      className="no-scroll"
    >
      <div className="rd-scroll" ref={scroller} onScroll={onScroll}>
        <div className="rd-page">
          {range.lo > 1 ? <div className="rd-more t-caption faint">Chapter {range.lo - 1} above</div> : null}
          {chapters.map((c) => (
            <ReaderChapter key={c} chapter={c} show={show} s={s} onReady={tryJump} />
          ))}
          {range.hi < 18 ? <div className="rd-more t-caption faint">Loading chapter {range.hi + 1}…</div> : <div className="rd-fin deva">॥ ॐ तत्सत् ॥</div>}
        </div>
      </div>
    </Frame>
  );
}

function ReaderChapter({ chapter, show, s, onReady }) {
  const { data: verses } = useChapterVerses(chapter);
  useLayoutEffect(() => {
    if (verses) onReady();
  }, [verses, onReady]);
  const meta = CHAPTERS[chapter];
  const sc = s.script === "ro" ? "dv" : s.script;
  return (
    <section className="rd-chapter">
      <header className="rd-chapter-head" data-chapter-head={chapter}>
        <div className="deva accent rd-ordinal">{toScript(`${meta.ordinal} · ${meta.sa}`, sc)}</div>
        <h2 className="t-title">
          Chapter {chapter} · {meta.name}
        </h2>
        <div className="t-small muted">
          {meta.en} · {VERSE_COUNTS[chapter]} verses
        </div>
      </header>
      {verses ? verses.map((v) => <ReaderVerse key={v.id} v={v} show={show} s={s} />) : <Skeleton h={240} />}
      <div className="rd-colophon deva">
        {toScript(`ॐ तत्सदिति श्रीमद्भगवद्गीतासूपनिषत्सु ब्रह्मविद्यायां योगशास्त्रे श्रीकृष्णार्जुनसंवादे ${meta.sa.replace(/ः$/, "ो")} नाम ${meta.ordinal} ॥`, sc)}
      </div>
    </section>
  );
}

/**
 * One verse: the text on the left, the reader's note in the right margin (like a
 * comment in a document). The sloka shows at once; the other parts load when the
 * verse nears the screen.
 */
const ReaderVerse = memo(function ReaderVerse({ v, show, s }) {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const key = `${v.chapter}.${v.verse}`;
  const hasNote = useSelector((st) => !!st.library.notes[key]);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "1200px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <article ref={ref} className="rd-verse" data-key={key}>
      <div className="rd-main">
        <div className="rd-num tnum" aria-label={`Verse ${key}`}>
          {key}
        </div>
        <VerseMenu v={v} script={s.script} hasNote={hasNote} onNote={() => setNoteOpen(true)} />
        {show.sloka ? <Sloka verse={v} script={s.script} size={25 * s.fontScale} showIast={s.showIast} /> : null}
        {near ? <VerseParts v={v} show={show} s={s} /> : !show.sloka ? <div style={{ minHeight: 120 }} /> : null}
      </div>
      <aside className="rd-margin" aria-label={`Note on ${key}`}>
        {hasNote ? <NoteCard verseKey={key} onOpen={() => setNoteOpen(true)} /> : <AddNote onOpen={() => setNoteOpen(true)} />}
      </aside>
      <NoteDialog verseKey={key} verse={v} script={s.script} open={noteOpen} onClose={() => setNoteOpen(false)} />
    </article>
  );
});

function VerseParts({ v, show, s }) {
  const { data: study } = useStudyUnits(show.padaccheda ? v.id : null);
  const { data: words } = useWordMeanings(show.words ? v : null);
  const { data: texts } = useTexts(show.translation ? v.id : null, "translation");
  const tr = pickTranslation(texts, s.primaryTranslatorId);
  const teluguScript = s.teluguScript === "follow" ? s.script : "te";
  const hl = useHighlighter({
    textId: tr?.id,
    verseKey: `${v.chapter}.${v.verse}`,
    authorName: tr ? authorName(tr.authorId, tr.authorName) : "",
    authorId: tr?.authorId,
    kind: "translation",
  });
  const hasPad = !!study?.some((u) => (u.blocks || []).some((b) => b.padaccheda && (b.verses || []).includes(v.verse)));
  return (
    <>
      {show.padaccheda && hasPad ? (
        <div className="rd-part">
          <div className="rd-label">Padaccheda</div>
          <Padaccheda units={study} chapter={v.chapter} verseNo={v.verse} script={s.script} />
        </div>
      ) : null}
      {show.words && words?.meanings?.length ? (
        <div className="rd-part">
          <div className="rd-label">Word by word</div>
          <p className="rd-words">
            {words.meanings.map((m, k) => (
              <span key={k}>
                {words.lang === "telugu" ? (
                  <>
                    <span className="rd-term" style={{ fontFamily: scriptFont(s.script) }}>
                      {fromTelugu(m.termTe, s.script)}
                    </span>{" "}
                    = <span style={{ fontFamily: teluguScript === "te" ? "var(--font-telugu)" : scriptFont(teluguScript) }}>{fromTelugu(m.meaning.replace(NOTE, ""), teluguScript)}</span>
                  </>
                ) : (
                  <>
                    <span className="rd-term iast">{m.termIast}</span> — {m.meaning}
                  </>
                )}
                {k < words.meanings.length - 1 ? "; " : ""}
              </span>
            ))}
          </p>
        </div>
      ) : null}
      {show.translation && tr ? (
        <div className="rd-part">
          {show.sloka || show.padaccheda || show.words ? <div className="rd-label">{tr.authorName}</div> : null}
          <Blocks blocks={tr.blocks} lang={tr.lang} teluguScript={teluguScript} size={18 * s.fontScale} highlights={hl.highlights} onSelect={hl.onSelect} />
          {hl.toolbar}
        </div>
      ) : null}
    </>
  );
}

function VerseMenu({ v, script, hasNote, onNote }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const key = `${v.chapter}.${v.verse}`;
  const bookmarked = useSelector((st) => !!st.library.bookmarks[key]);
  return (
    <div className="rd-menu">
      {bookmarked ? <BookmarkCheck size={15} className="accent" aria-label="Bookmarked" /> : null}
      <Menu
        trigger={(open) => <IconButton icon={MoreHorizontal} label={`Verse ${key} actions`} className="sm" size={16} onClick={open} />}
        items={[
          { label: "Open verse page — commentaries, word study", icon: ExternalLink, onSelect: () => navigate(`/verse/${v.chapter}/${v.verse}`) },
          { label: hasNote ? "Open your note" : "Add a note", icon: NotebookPen, onSelect: onNote },
          { label: bookmarked ? "Remove bookmark" : "Bookmark", icon: Bookmark, onSelect: () => dispatch(toggleBookmark(key)) },
          {
            label: "Copy verse",
            icon: Copy,
            onSelect: async () => {
              await copyText(`${verseLines(v, script).join("\n")}\n— Bhagavad Gita ${key}`);
              toast("Copied");
            },
          },
        ]}
      />
    </div>
  );
}

