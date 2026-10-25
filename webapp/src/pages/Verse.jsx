import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  MoreHorizontal,
  PanelRight,
  Pin,
  Share,
  Star,
  Type,
} from "lucide-react";
import Frame from "../components/Frame";
import { Blocks, FootnoteMark, Sloka } from "../components/reading";
import { useHighlighter } from "../components/Highlighter";
import StudyPanel from "../components/StudyPanel";
import { NoteCard, NoteDialog } from "../components/Notes";
import { IconButton, Menu, MOD, Skeleton, useToast } from "../components/ui";
import { prefetchVerse, useStudyUnits, useTexts, useVerse, useWordMeanings } from "../data/gita";
import { markRead, setLast, setSetting, toggleBookmark, togglePinnedCommentator, unmarkRead } from "../state/store";
import { authorName, bookIndex, CHAPTERS, fromBookIndex, langLabel, TOTAL_VERSES, VERSE_COUNTS } from "../../../src/lib/names";
import { describeText, orderCommentaries, pickTranslation, previewOf } from "../../../src/lib/texts";
import { mapPadacchedaToMeanings, mapTokensToMeanings, wordSourceInfo } from "../../../src/lib/wordMeanings";
import { padacchedaItems, padacchedaParts, splitPadaccheda, groupCaption, NOTE } from "../lib/study";
import { fromTelugu, scriptFont } from "../lib/script";
import { plainText } from "../lib/text";
import { copyText, shareText } from "../lib/share";
import { editing } from "../App";
import { useScrollMemory } from "../lib/nav";

export default function Verse({ onSettings }) {
  const params = useParams();
  const chapter = Number(params.c);
  const v = Number(params.v);
  const key = `${chapter}.${v}`;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const s = useSelector((st) => st.settings);
  const bookmarked = useSelector((st) => !!st.library.bookmarks[key]);
  const isRead = useSelector((st) => !!st.progress.read[key]);
  const hasNote = useSelector((st) => !!st.library.notes[key]);
  const [noteOpen, setNoteOpen] = useState(false);
  const panelOpen = s.panelOpen !== false;
  const index = bookIndex(chapter, v);
  const prev = index > 1 ? fromBookIndex(index - 1) : null;
  const next = index < TOTAL_VERSES ? fromBookIndex(index + 1) : null;

  const { data: verse } = useVerse(chapter, v);
  const { data: words } = useWordMeanings(verse);
  const { data: translations } = useTexts(verse?.id, "translation");
  const { data: commentaries } = useTexts(verse?.id, "commentary");
  const { data: study } = useStudyUnits(verse?.id);
  const [panelTab, setPanelTab] = useState("word");
  const [wordSel, setWordSel] = useState(null); // {ids:[...], from: 'verse'|'pad'|'list', token}
  const mainRef = useRef(null);
  useScrollMemory(mainRef, `/verse/${key}`);

  // Arriving at a verse: remember it, preload neighbours, reset the word panel.
  useEffect(() => {
    dispatch(setLast({ chapter, verse: v }));
    for (const p of [prev, next]) if (p) prefetchVerse(p.chapter, p.verse);
    setWordSel(null);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback(
    (p) => {
      if (!p) return;
      if (s.markReadOnMove) dispatch(markRead(key));
      navigate(`/verse/${p.chapter}/${p.verse}`);
    },
    [dispatch, key, navigate, s.markReadOnMove]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (editing(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") go(prev);
      else if (e.key === "ArrowRight") go(next);
      else if (e.key === "b") dispatch(toggleBookmark(key));
      else if (e.key === "n") {
        dispatch(setSetting({ panelOpen: true }));
        setPanelTab("note");
        e.preventDefault();
      } else if (e.key === "Escape") setWordSel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, prev, next, dispatch, key]);

  const tokenMap = useMemo(() => (verse && words?.meanings?.length ? mapTokensToMeanings(verse.iastLines, words.meanings, words.words) : null), [verse, words]);
  const showPad = s.showPadaccheda !== false && !!study?.some((u) => (u.blocks || []).some((b) => b.padaccheda && (b.verses || []).includes(v)));
  const padMap = useMemo(
    () => (showPad && words?.meanings?.length ? mapPadacchedaToMeanings(padacchedaItems(study, v), words.meanings, words.words) : null),
    [showPad, study, v, words]
  );
  const openWord = (ids, from, token) => {
    if (!ids?.length) return;
    setWordSel({ ids, from, token });
    setPanelTab("word");
    if (!panelOpen) dispatch(setSetting({ panelOpen: true }));
  };
  const activeTokens = useMemo(() => {
    if (!wordSel || !tokenMap) return null;
    const set = new Set();
    tokenMap.forEach((ids, t) => ids.some((k) => wordSel.ids.includes(k)) && set.add(t));
    return set;
  }, [wordSel, tokenMap]);

  const meta = CHAPTERS[chapter];
  const teluguScript = s.teluguScript === "follow" ? s.script : "te";
  const size = 30 * s.fontScale;

  const actions = (
    <>
      <span className="t-caption muted tnum" style={{ marginRight: 4 }}>
        {v} of {VERSE_COUNTS[chapter]}
      </span>
      <IconButton icon={ChevronLeft} label={prev ? `Previous verse · ${prev.chapter}.${prev.verse}` : "First verse"} keys={["←"]} disabled={!prev} onClick={() => go(prev)} />
      <IconButton icon={ChevronRight} label={next ? `Next verse · ${next.chapter}.${next.verse}` : "Last verse"} keys={["→"]} disabled={!next} onClick={() => go(next)} />
      <span className="divider" />
      <IconButton icon={isRead ? CheckCircle2 : Check} on={isRead} label={isRead ? "Marked as read" : "Mark as read"} onClick={() => dispatch(isRead ? unmarkRead(key) : markRead(key))} />
      <IconButton icon={bookmarked ? BookmarkCheck : Bookmark} on={bookmarked} label={bookmarked ? "Remove bookmark" : "Bookmark"} keys={["B"]} onClick={() => dispatch(toggleBookmark(key))} />
      <IconButton icon={Type} label="Reading settings" keys={[MOD, ","]} onClick={onSettings} />
      <IconButton icon={PanelRight} on={panelOpen} label={panelOpen ? "Hide study panel" : "Show study panel"} onClick={() => dispatch(setSetting({ panelOpen: !panelOpen }))} />
    </>
  );

  return (
    <Frame
      crumbs={[
        { label: "Chapters", to: "/chapters" },
        { label: `${chapter} · ${meta.name}`, to: `/chapter/${chapter}` },
        { label: `Verse ${v}` },
      ]}
      actions={actions}
      className="no-scroll"
    >
      <div className={`verse-layout ${panelOpen ? "with-panel" : ""}`}>
        <div className="verse-main" ref={mainRef}>
          <article className="verse-article">
            <header className={`verse-hero ${hasNote ? "with-note" : ""}`}>
              <div className="verse-eyebrow">
                <Link to={`/chapter/${chapter}`} className="t-eyebrow">
                  Chapter {chapter} · {meta.name}
                </Link>
                <span className="verse-ref tnum">{key}</span>
              </div>
              {verse ? (
                <Sloka verse={verse} script={s.script} size={size} showIast={s.showIast} onWord={tokenMap ? (t) => openWord(tokenMap[t], "verse", t) : undefined} activeTokens={activeTokens} />
              ) : (
                <div className="stack" style={{ gap: 14, alignItems: "center", padding: "12px 0" }}>
                  <Skeleton h={34} w="70%" />
                  <Skeleton h={34} w="64%" />
                </div>
              )}
              {tokenMap ? <p className="verse-hint">Click any word for its meaning and grammar</p> : null}
              {hasNote ? (
                <aside className="verse-note" aria-label="Your note">
                  <NoteCard verseKey={key} onOpen={() => setNoteOpen(true)} />
                </aside>
              ) : null}
            </header>
            <NoteDialog verseKey={key} verse={verse} script={s.script} open={noteOpen} onClose={() => setNoteOpen(false)} />

            <TranslationSection chapter={chapter} v={v} translations={translations} s={s} teluguScript={teluguScript} />

            {showPad ? (
              <Section title="Padaccheda" sub="పదచ్ఛేదః · words separated" source="Swami Nirvikalpananda">
                <Padaccheda units={study} chapter={chapter} verseNo={v} script={s.script} onWord={padMap ? (k) => openWord(padMap[k], "pad") : undefined} selected={wordSel} padMap={padMap} />
              </Section>
            ) : null}

            <Section
              title="Word by word"
              source={words ? wordSourceInfo(words.source).name : ""}
              menu={
                words?.meanings?.length ? (
                  <CopyShareMenu
                    text={() => words.meanings.map((m) => `${m.termIast} — ${m.meaning}`).join("\n")}
                    cite={`— ${wordSourceInfo(words.source).name}, Bhagavad Gita ${key}`}
                  />
                ) : null
              }
            >
              {words ? (
                <WordList words={words} chapter={chapter} v={v} script={s.script} teluguScript={teluguScript} selected={wordSel} onPick={(k) => openWord([k], "list")} />
              ) : (
                <Skeleton h={80} />
              )}
            </Section>

            <CommentarySection chapter={chapter} v={v} commentaries={commentaries} pinned={s.pinnedCommentators} />

            <nav className="verse-pager" aria-label="Verse navigation">
              {prev ? (
                <button type="button" className="pager-card" onClick={() => go(prev)}>
                  <span className="t-caption muted row">
                    <ArrowLeft size={13} /> Previous
                  </span>
                  <span className="t-strong">Verse {prev.chapter}.{prev.verse}</span>
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button type="button" className="pager-card end" onClick={() => go(next)}>
                  <span className="t-caption muted row" style={{ justifyContent: "flex-end" }}>
                    Next <ArrowRight size={13} />
                  </span>
                  <span className="t-strong">Verse {next.chapter}.{next.verse}</span>
                </button>
              ) : null}
            </nav>
          </article>
        </div>
        {panelOpen ? (
          <StudyPanel
            tab={panelTab}
            onTab={setPanelTab}
            verse={verse}
            verseKey={key}
            words={words}
            selection={wordSel}
            onSelect={(ids) => setWordSel(ids ? { ids, from: "panel" } : null)}
            script={s.script}
            teluguScript={teluguScript}
            onClose={() => dispatch(setSetting({ panelOpen: false }))}
            toast={toast}
          />
        ) : null}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- sections
function Section({ title, sub, source, menu, right, children, id }) {
  return (
    <section className="v-section" id={id}>
      <div className="v-section-head">
        <h2>{title}</h2>
        {sub ? <span className="v-section-sub">{sub}</span> : null}
        <span className="grow" />
        {right}
        {source ? <span className="t-caption muted">{source}</span> : null}
        {menu}
      </div>
      {children}
    </section>
  );
}

function CopyShareMenu({ text, cite, extra = [] }) {
  const toast = useToast();
  const message = () => `${text().trim()}\n\n${cite || ""}`.trim();
  return (
    <Menu
      trigger={(open) => <IconButton icon={MoreHorizontal} label="More actions" size={16} className="sm" onClick={open} />}
      items={[
        {
          label: "Copy",
          icon: Copy,
          onSelect: async () => {
            await copyText(message());
            toast("Copied");
          },
        },
        { label: "Share…", icon: Share, onSelect: () => shareText(message(), toast) },
        ...(extra.length ? ["sep", ...extra] : []),
      ]}
    />
  );
}

function TranslationSection({ chapter, v, translations, s, teluguScript }) {
  const dispatch = useDispatch();
  const [pick, setPick] = useState(null);
  useEffect(() => setPick(null), [chapter, v]);
  const tr = (pick && translations?.find((t) => t.authorId === pick)) || pickTranslation(translations, s.primaryTranslatorId);
  const hl = useHighlighter({
    textId: tr?.id,
    verseKey: `${chapter}.${v}`,
    authorName: tr ? authorName(tr.authorId, tr.authorName) : "",
    authorId: tr?.authorId,
    kind: "translation",
  });
  if (!translations) {
    return (
      <Section title="Translation">
        <Skeleton h={22} />
        <Skeleton h={22} w="80%" style={{ marginTop: 10 }} />
      </Section>
    );
  }
  if (!tr) return null;
  const name = authorName(tr.authorId, tr.authorName);
  return (
    <Section
      title="Translation"
      right={
        <select className="input tr-select" value={tr.authorId} onChange={(e) => setPick(Number(e.target.value))} aria-label="Translator">
          {translations.map((t) => (
            <option key={t.id} value={t.authorId}>
              {authorName(t.authorId, t.authorName)} · {langLabel(t.lang)}
            </option>
          ))}
        </select>
      }
      menu={
        <CopyShareMenu
          text={() => plainText(tr.blocks)}
          cite={`— ${name}, Bhagavad Gita ${chapter}.${v}`}
          extra={tr.authorId !== s.primaryTranslatorId ? [{ label: "Make default translation", icon: Star, onSelect: () => dispatch(setSetting({ primaryTranslatorId: tr.authorId })) }] : []}
        />
      }
    >
      <Blocks blocks={tr.blocks} lang={tr.lang} teluguScript={teluguScript} size={19 * s.fontScale} highlights={hl.highlights} onSelect={hl.onSelect} className="tr-text" />
      {hl.toolbar}
      <div className="v-section-foot">
        <span className="t-caption muted">Select words to highlight, copy or add them to your note</span>
        <Link to={`/verse/${chapter}/${v}/translations`} state={{ fromVerse: true }} className="link t-small row">
          <Columns2 size={14} /> Compare all {translations.length}
        </Link>
      </div>
    </Section>
  );
}

export function Padaccheda({ units, chapter, verseNo, script, onWord, selected, padMap }) {
  const conv = (t) => fromTelugu(t, script === "dv" ? "dv" : script);
  const parts = padacchedaParts(units, verseNo);
  if (!parts.length) return null;
  const notes = parts[0].u.footnotes || [];
  const covered = [...new Set(parts.flatMap(({ b }) => b.verses || []))].sort((a, b) => a - b);
  let wordNo = -1;
  const withNotes = (text) => {
    const out = [];
    let at = 0;
    for (const m of text.matchAll(NOTE)) {
      if (m.index > at) out.push(conv(text.slice(at, m.index)));
      const n = Number(m[1]);
      out.push(<FootnoteMark key={m.index} n={n} note={notes.find((f) => f.n === n)} font="var(--font-telugu)" />);
      at = m.index + m[0].length;
    }
    if (at < text.length) out.push(conv(text.slice(at)));
    return out;
  };
  return (
    <div className="pad" style={{ fontFamily: scriptFont(script) }}>
      {parts.map(({ b }, i) => (
        <p key={i} className="pad-line">
          {splitPadaccheda(b.padaccheda).map((x, k) => {
            if (x.sep || !onWord) return <span key={k}>{withNotes(x.text)}</span>;
            const my = ++wordNo;
            const on = selected && padMap?.[my]?.some((id) => selected.ids.includes(id));
            return (
              <button type="button" key={k} className={`w ${on ? "on" : ""}`} onClick={() => onWord(my)}>
                {withNotes(x.text)}
              </button>
            );
          })}
        </p>
      ))}
      {covered.length > 1 ? (
        <p className="t-caption muted">
          {parts.length > 1
            ? `The book prints this verse in two passages (with ${chapter}.${covered.filter((x) => x !== verseNo).join(", ")}); both are shown.`
            : `In the book this passage covers verses ${chapter}.${covered[0]}–${covered[covered.length - 1]}.`}
        </p>
      ) : null}
    </div>
  );
}

function WordList({ words, chapter, v, script, teluguScript, selected, onPick }) {
  const telugu = words.lang === "telugu";
  const caption = telugu && words.units?.[0] ? groupCaption(chapter, words.units[0], v) : null;
  return (
    <>
      {caption ? <p className="t-caption muted" style={{ marginBottom: 10 }}>{caption}</p> : null}
      <div className={`wbw ${telugu ? "telugu" : ""}`}>
        {words.meanings.map((m, k) => (
          <button type="button" key={k} className={`wbw-row ${selected?.ids.includes(k) ? "on" : ""}`} onClick={() => onPick(k)}>
            {telugu ? (
              <span className="wbw-term" style={{ fontFamily: scriptFont(script) }}>
                {m.implied ? "(" : ""}
                {fromTelugu(m.termTe, script)}
                {m.implied ? ")" : ""}
              </span>
            ) : (
              <span className="wbw-term iast">{m.termIast}</span>
            )}
            <span className="wbw-mean" style={telugu ? { fontFamily: teluguScript === "te" ? "var(--font-telugu)" : scriptFont(teluguScript) } : null}>
              {telugu ? fromTelugu(m.meaning.replace(NOTE, ""), teluguScript) : m.meaning}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function CommentarySection({ chapter, v, commentaries, pinned }) {
  const dispatch = useDispatch();
  const coms = useMemo(() => orderCommentaries(commentaries, pinned), [commentaries, pinned]);
  const pinnedComs = coms.filter((t) => pinned.includes(t.authorId)).slice(0, 2);
  const rest = coms.filter((t) => !pinnedComs.includes(t));
  if (!commentaries) return null;
  return (
    <Section
      title="Commentaries"
      right={
        <Link to={`/verse/${chapter}/${v}/commentary`} state={{ fromVerse: true }} className="link t-small">
          Open reader
        </Link>
      }
      source={`${commentaries.length} on this verse`}
    >
      <div className="com-pinned">
        {pinnedComs.map((t) => {
          const d = describeText(t);
          return (
            <Link key={t.id} to={`/verse/${chapter}/${v}/commentary/${t.authorId}`} state={{ fromVerse: true }} className="card hoverable com-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="t-strong">{d.name}</span>
                <span className="t-caption muted">
                  {d.school} · {langLabel(t.lang)} · {d.minutes} min
                </span>
              </div>
              <p className="com-preview" style={{ fontFamily: t.lang === "english" ? "var(--font-serif)" : "var(--font-deva)" }}>
                {previewOf(t.blocks, 260)}
              </p>
              <span className="com-pin" title="Pinned" onClick={(e) => {
                e.preventDefault();
                dispatch(togglePinnedCommentator(t.authorId));
              }}>
                <Pin size={13} />
              </span>
            </Link>
          );
        })}
      </div>
      <div className="com-list">
        {rest.map((t) => {
          const d = describeText(t);
          return (
            <Link key={t.id} to={`/verse/${chapter}/${v}/commentary/${t.authorId}`} state={{ fromVerse: true }} className="com-row">
              <span className="t-strong ellipsis">{d.name}</span>
              <span className="t-caption muted ellipsis">{d.school}</span>
              <span className="t-caption muted">{langLabel(t.lang)}</span>
              <span className="t-caption muted tnum">{d.minutes} min</span>
              <ChevronRight size={14} className="faint" />
            </Link>
          );
        })}
      </div>
    </Section>
  );
}
