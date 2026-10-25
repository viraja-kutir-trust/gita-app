import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ChevronDown, ChevronUp, Copy, MoreHorizontal, Pin, PinOff, Search, Share, X } from "lucide-react";
import Frame from "../components/Frame";
import { Blocks, Sloka } from "../components/reading";
import { useHighlighter } from "../components/Highlighter";
import { Empty, IconButton, Menu, MOD, Segmented, Skeleton, useToast } from "../components/ui";
import { useTexts, useVerse } from "../data/gita";
import { setSetting, togglePinnedCommentator } from "../state/store";
import { countMatches, plainText } from "../lib/text";
import { scriptByKey } from "../lib/script";
import { copyText, shareText } from "../lib/share";
import { CHAPTERS, LANGS, SCHOOLS, langLabel } from "../../../src/lib/names";
import { describeText, orderCommentaries } from "../../../src/lib/texts";
import { editing } from "../App";
import { useCloseToVerse, useScrollMemory } from "../lib/nav";

export default function Commentary() {
  const { c, v, author } = useParams();
  const chapter = Number(c);
  const vn = Number(v);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const settings = useSelector((s) => s.settings);
  const { data: verse } = useVerse(chapter, vn);
  const { data: texts } = useTexts(verse?.id, "commentary");
  const ordered = useMemo(() => orderCommentaries(texts, settings.pinnedCommentators), [texts, settings.pinnedCommentators]);
  const [filter, setFilter] = useState(params.get("q") || "");
  const [school, setSchool] = useState("All");
  const [lang, setLang] = useState("any");
  const [find, setFind] = useState(params.get("q") || "");
  const [match, setMatch] = useState(0);
  const [showVerse, setShowVerse] = useState(true);
  const readerRef = useRef(null);
  const findRef = useRef(null);
  const location = useLocation();
  const close = useCloseToVerse(chapter, vn);

  const current = ordered.find((t) => String(t.authorId) === String(author)) || ordered[0];
  const langs = useMemo(() => [...new Set((texts || []).map((t) => t.lang))], [texts]);
  const filterTerms = useMemo(() => filter.trim().split(/\s+/).filter((t) => t.length >= 2), [filter]);
  const rows = useMemo(
    () =>
      ordered
        .map((t) => {
          const d = describeText(t);
          const nameHit = !filterTerms.length || filterTerms.every((x) => d.name.toLowerCase().includes(x.toLowerCase()));
          const hits = filterTerms.length ? countMatches(t.blocks, filterTerms) : 0;
          return { t, d, hits, nameHit };
        })
        .filter(({ t, d, hits, nameHit }) => (school === "All" || d.school === school) && (lang === "any" || t.lang === lang) && (!filterTerms.length || nameHit || hits > 0)),
    [ordered, filterTerms, school, lang]
  );

  const terms = useMemo(() => find.trim().split(/\s+/).filter((t) => t.length >= 2), [find]);
  const total = useMemo(() => (current ? countMatches(current.blocks, terms) : 0), [current, terms]);
  useEffect(() => setMatch(0), [current?.id, find]);
  useScrollMemory(readerRef, current ? `/verse/${chapter}/${vn}/commentary/${current.authorId}` : null);
  useEffect(() => {
    if (!terms.length) return;
    const el = readerRef.current?.querySelector(`[data-mark="${match}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [match, terms, current?.id]);

  const hl = useHighlighter({
    textId: current?.id,
    verseKey: `${chapter}.${vn}`,
    authorName: current ? describeText(current).name : "",
    authorId: current?.authorId,
    kind: "commentary",
  });

  const idx = current ? ordered.indexOf(current) : -1;
  const open = (t) => t && navigate(`/verse/${chapter}/${vn}/commentary/${t.authorId}${find ? `?q=${encodeURIComponent(find)}` : ""}`, { replace: true, state: location.state });
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        findRef.current?.focus();
        findRef.current?.select();
        return;
      }
      if (editing(document.activeElement) || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        open(ordered[idx + 1]);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        open(ordered[idx - 1]);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const d = current ? describeText(current) : null;
  const isPinned = current && settings.pinnedCommentators.includes(current.authorId);
  const sanskritLike = current && (current.lang === "sanskrit" || current.lang === "hindi");
  const scriptOptions = [...new Set(["dv", settings.script !== "dv" && settings.script !== "ro" ? settings.script : "te", "ro"])];
  const comScript = scriptOptions.includes(settings.commentaryScript) ? settings.commentaryScript : "dv";
  const cite = d ? `— ${d.name}, on Bhagavad Gita ${chapter}.${vn}` : "";

  return (
    <Frame
      crumbs={[
        { label: `${chapter} · ${CHAPTERS[chapter].name}`, to: `/chapter/${chapter}` },
        { label: `Verse ${vn}`, to: `/verse/${chapter}/${vn}` },
        { label: "Commentaries" },
      ]}
      className="no-scroll"
      close={{ label: `Close commentaries, back to verse ${chapter}.${vn}`, text: `Back to ${chapter}.${vn}`, onClick: close }}
    >
      <div className="md-layout">
        <aside className="md-list">
          <div className="md-list-head">
            <div className="input-wrap">
              <Search size={15} />
              <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Names or words inside" aria-label="Filter commentaries" />
              {filter ? (
                <span className="trail">
                  <IconButton icon={X} label="Clear" className="sm" size={14} onClick={() => setFilter("")} />
                </span>
              ) : null}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <select className="input" value={school} onChange={(e) => setSchool(e.target.value)} aria-label="School">
                {SCHOOLS.map((s) => (
                  <option key={s} value={s}>
                    {s === "All" ? "All schools" : s}
                  </option>
                ))}
              </select>
              {langs.length > 1 ? (
                <select className="input" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
                  <option value="any">All languages</option>
                  {langs.map((l) => (
                    <option key={l} value={l}>
                      {LANGS[l]?.label || l}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="t-caption muted">
              {texts ? (filterTerms.length ? `${rows.length} of ${texts.length} mention “${filter.trim()}”` : `${rows.length} of ${texts.length} · pinned first`) : "Loading…"}
            </div>
          </div>
          <div className="md-list-body">
            {rows.map(({ t, d: dd, hits }) => (
              <button key={t.id} type="button" className={`md-item ${current?.id === t.id ? "on" : ""}`} onClick={() => open(t)}>
                <span className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                  <span className="t-strong ellipsis">{dd.name}</span>
                  {settings.pinnedCommentators.includes(t.authorId) ? <Pin size={12} className="accent" style={{ flex: "none" }} /> : null}
                </span>
                <span className="t-caption muted ellipsis">
                  {dd.school} · {langLabel(t.lang)} · {dd.minutes} min
                  {hits ? ` · ${hits} ${hits === 1 ? "match" : "matches"}` : ""}
                </span>
              </button>
            ))}
            {texts && !rows.length ? <Empty title="No commentary matches">Try another word, or clear the filters.</Empty> : null}
          </div>
        </aside>

        <div className="md-reader" ref={readerRef}>
          {current ? (
            <article className="reader">
              <header className="reader-head">
                <div className="grow">
                  <div className="t-eyebrow">
                    {d.school} · {langLabel(current.lang)} · {d.minutes} min read
                  </div>
                  <h1 className="t-title" style={{ marginTop: 4 }}>
                    {d.name}
                  </h1>
                </div>
                <IconButton icon={isPinned ? PinOff : Pin} on={isPinned} label={isPinned ? "Unpin commentator" : "Pin to the top on every verse"} onClick={() => dispatch(togglePinnedCommentator(current.authorId))} />
                <Menu
                  trigger={(o) => <IconButton icon={MoreHorizontal} label="More actions" onClick={o} />}
                  items={[
                    {
                      label: "Copy commentary",
                      icon: Copy,
                      onSelect: async () => {
                        await copyText(`${plainText(current.blocks)}\n\n${cite}`);
                        toast("Copied");
                      },
                    },
                    { label: "Share…", icon: Share, onSelect: () => shareText(`${plainText(current.blocks)}\n\n${cite}`, toast) },
                  ]}
                />
              </header>

              <div className="reader-tools">
                <div className="input-wrap grow">
                  <Search size={15} />
                  <input ref={findRef} className="input" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find in this commentary" aria-label="Find in this commentary" onKeyDown={(e) => e.key === "Enter" && total && setMatch((m) => (e.shiftKey ? (m - 1 + total) % total : (m + 1) % total))} />
                  {terms.length ? <span className="trail tnum">{total ? `${match + 1} of ${total}` : "No matches"}</span> : null}
                </div>
                <IconButton icon={ChevronUp} label="Previous match" disabled={!total} onClick={() => setMatch((m) => (m - 1 + total) % total)} />
                <IconButton icon={ChevronDown} label="Next match" disabled={!total} onClick={() => setMatch((m) => (m + 1) % total)} />
                {sanskritLike ? (
                  <Segmented value={comScript} onChange={(k) => dispatch(setSetting({ commentaryScript: k }))} label="Script" options={scriptOptions.map((k) => ({ value: k, label: scriptByKey[k].label, style: { fontFamily: scriptByKey[k].font } }))} />
                ) : null}
              </div>

              <div className="reader-verse">
                <button type="button" className="reader-verse-toggle" onClick={() => setShowVerse((x) => !x)}>
                  <span className="t-caption accent t-strong">{chapter}.{vn}</span>
                  <span className="t-caption muted">{showVerse ? "Hide verse" : "Show verse"}</span>
                </button>
                {showVerse && verse ? (
                  <Link to={`/verse/${chapter}/${vn}`} className="reader-verse-body">
                    <Sloka verse={verse} script={settings.script} size={21} showIast={false} />
                  </Link>
                ) : null}
              </div>

              <Blocks
                blocks={current.blocks}
                lang={current.lang}
                script={sanskritLike ? comScript : "dv"}
                size={18 * settings.fontScale}
                terms={terms}
                currentMatch={terms.length ? match : -1}
                highlights={hl.highlights}
                onSelect={hl.onSelect}
              />
              {hl.toolbar}
              <footer className="reader-foot">
                <span className="t-caption muted">{current.attribution || current.license || ""}</span>
                <span className="t-caption faint">
                  <span className="kbd">↑</span> <span className="kbd">↓</span> switch commentator · <span className="kbd">{MOD} F</span> find
                </span>
              </footer>
            </article>
          ) : (
            <div className="reader">
              <Skeleton h={28} w="40%" />
              <Skeleton h={18} style={{ marginTop: 24 }} />
              <Skeleton h={18} style={{ marginTop: 10 }} />
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}
