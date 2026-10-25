import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ArrowRight, History, Search as SearchIcon, X } from "lucide-react";
import Frame from "../components/Frame";
import { Empty, IconButton, Segmented } from "../components/ui";
import { whenGita } from "../data/gita";
import { setSetting } from "../state/store";
import { scriptFont, toScript } from "../lib/script";
import { authorName, CHAPTERS, langLabel } from "../../../src/lib/names";

const SCOPES = [
  { value: "all", label: "All" },
  { value: "verses", label: "Sanskrit" },
  { value: "translations", label: "Translations" },
  { value: "commentaries", label: "Commentaries" },
  { value: "meanings", label: "Word meanings" },
];
const SUGGESTIONS = ["2.47", "karmanye", "कर्मण्ये", "sthita prajna", "fruit of action", "yoga", "atman", "devotion"];
const PAGE = 30;

/** Snippet with its match offsets highlighted. */
function Snippet({ text, matches, className, style }) {
  if (!matches?.length) return <span className={className} style={style}>{text}</span>;
  const out = [];
  let at = 0;
  matches.forEach((m, i) => {
    if (m.start > at) out.push(text.slice(at, m.start));
    out.push(<mark key={i}>{text.slice(m.start, m.end)}</mark>);
    at = m.end;
  });
  out.push(text.slice(at));
  return <span className={className} style={style}>{out}</span>;
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const script = useSelector((s) => s.settings.script);
  const recent = useSelector((s) => s.settings.recentSearches) || [];
  const [q, setQ] = useState(params.get("q") || "");
  const [scope, setScope] = useState(params.get("scope") || "all");
  const [chapter, setChapter] = useState(params.get("ch") ? Number(params.get("ch")) : null);
  const [res, setRes] = useState({ results: [] });
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const seq = useRef(0);
  const input = useRef(null);

  useEffect(() => {
    const pq = params.get("q") || "";
    if (pq !== q) setQ(pq);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    const term = q.trim();
    const next = {};
    if (term) next.q = term;
    if (scope !== "all") next.scope = scope;
    if (chapter) next.ch = String(chapter);
    setParams(next, { replace: true });
    if (!term) {
      setRes({ results: [] });
      return undefined;
    }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const gita = await whenGita();
        const r = await gita.search(term, { scope, chapter, limit: PAGE, offset: 0 });
        if (my !== seq.current) return;
        const shown = r.results.filter((x) => x.matches?.length);
        const hidden = r.results.filter((x) => !x.matches?.length).map((x) => ({ ...x, viaMeanings: x.kind === "verse" && r.queryType !== "verse" }));
        setRes({ ...r, results: [...shown, ...hidden] });
        setMore(r.results.length >= PAGE);
      } catch (e) {
        if (my === seq.current) setRes({ results: [], error: String(e.message || e) });
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 160);
    return () => clearTimeout(t);
  }, [q, scope, chapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const remember = () => {
    const term = q.trim();
    if (term.length < 2) return;
    dispatch(setSetting({ recentSearches: [term, ...recent.filter((r) => r !== term)].slice(0, 8) }));
  };
  const loadMore = async () => {
    const gita = await whenGita();
    const r = await gita.search(q.trim(), { scope, chapter, limit: PAGE, offset: res.results.length });
    setRes((old) => ({ ...old, results: [...old.results, ...r.results.map((x) => (x.matches?.length ? x : { ...x, viaMeanings: x.kind === "verse" }))] }));
    setMore(r.results.length >= PAGE);
  };
  const hrefOf = (r) => (r.kind === "commentary" && r.authorId ? `/verse/${r.chapter}/${r.verse}/commentary/${r.authorId}?q=${encodeURIComponent(q.trim())}` : `/verse/${r.chapter}/${r.verse}`);
  const sc = script === "ro" ? "dv" : script;
  const grouped = useMemo(() => res.results, [res.results]);

  return (
    <Frame crumbs={[{ label: "Search" }]}>
      <div className="page narrow search-page">
        <div className="search-box">
          <SearchIcon size={20} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                remember();
                if (res.jump) navigate(res.jump.verse ? `/verse/${res.jump.chapter}/${res.jump.verse}` : `/chapter/${res.jump.chapter}`);
              }
            }}
            placeholder="A verse (2.47), a Sanskrit word in any script, or a phrase"
            aria-label="Search"
          />
          {q ? <IconButton icon={X} label="Clear" onClick={() => setQ("")} /> : null}
        </div>
        <div className="search-filters">
          <Segmented value={scope} onChange={setScope} options={SCOPES} label="Search in" />
          <select className="input" style={{ width: 220 }} value={chapter || ""} onChange={(e) => setChapter(e.target.value ? Number(e.target.value) : null)} aria-label="Chapter">
            <option value="">All chapters</option>
            {CHAPTERS.slice(1).map((ch, i) => (
              <option key={i} value={i + 1}>
                {i + 1} · {ch.name}
              </option>
            ))}
          </select>
        </div>

        {!q.trim() ? (
          <div className="search-idle">
            {recent.length ? (
              <section>
                <div className="t-eyebrow" style={{ marginBottom: 10 }}>
                  Recent
                </div>
                <div className="chips">
                  {recent.map((r) => (
                    <button key={r} type="button" className="chip" onClick={() => setQ(r)}>
                      <History size={13} /> {r}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <section>
              <div className="t-eyebrow" style={{ marginBottom: 10 }}>
                Try
              </div>
              <div className="chips">
                {SUGGESTIONS.map((r) => (
                  <button key={r} type="button" className="chip" onClick={() => setQ(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </section>
            <p className="t-small muted" style={{ maxWidth: 620 }}>
              Search understands verse numbers, Sanskrit in any script, romanised words with or without diacritics (krishna, kṛṣṇa, krsna), and English or Hindi phrases across every translation and commentary.
            </p>
          </div>
        ) : (
          <>
            <div className="t-small muted search-count">
              {busy ? "Searching…" : res.error ? `Search failed: ${res.error}` : res.results.length ? `${res.results.length}${more ? "+" : ""} results` : "No results"}
            </div>
            {res.jump ? (
              <Link to={res.jump.verse ? `/verse/${res.jump.chapter}/${res.jump.verse}` : `/chapter/${res.jump.chapter}`} className="card hoverable jump-card">
                <ArrowRight size={16} />
                <span className="t-strong">{res.jump.verse ? `Go to verse ${res.jump.chapter}.${res.jump.verse}` : `Open chapter ${res.jump.chapter} · ${CHAPTERS[res.jump.chapter].name}`}</span>
                <span className="kbd" style={{ marginLeft: "auto" }}>
                  Enter
                </span>
              </Link>
            ) : null}
            <div className="results">
              {grouped.map((r, i) => (
                <Link key={`${r.kind}-${r.textId || r.verseId}-${i}`} to={hrefOf(r)} className="result" onClick={remember}>
                  <div className="result-meta">
                    <span className="result-ref tnum">
                      {r.chapter}.{r.verse}
                    </span>
                    <span className="t-caption muted">
                      {r.kind === "verse"
                        ? r.viaMeanings
                          ? "Verse · matched in word meanings"
                          : "Verse"
                        : `${r.kind === "commentary" ? "Commentary" : "Translation"} · ${authorName(r.authorId, r.authorName, r.kind)}${r.lang && r.lang !== "english" ? ` · ${langLabel(r.lang)}` : ""}`}
                    </span>
                  </div>
                  {r.kind === "verse" ? (
                    <>
                      <div className="result-verse" style={{ fontFamily: scriptFont(sc) }}>
                        {(r.lines || []).map((l, k) => (
                          <div key={k}>{toScript(l, sc)}</div>
                        ))}
                      </div>
                      {res.queryType !== "devanagari" && r.matches?.length ? <Snippet text={r.snippet} matches={r.matches} className="result-iast" /> : null}
                    </>
                  ) : (
                    <Snippet text={r.snippet} matches={r.matches} className="result-text" style={{ fontFamily: r.lang === "english" ? "var(--font-serif)" : r.lang === "telugu" ? "var(--font-telugu)" : r.lang === "tamil" ? "var(--font-tamil)" : "var(--font-deva)" }} />
                  )}
                </Link>
              ))}
            </div>
            {more && !busy ? (
              <div style={{ textAlign: "center", marginTop: 18 }}>
                <button type="button" className="btn" onClick={loadMore}>
                  Load more results
                </button>
              </div>
            ) : null}
            {!busy && !res.results.length && !res.jump && !res.error ? <Empty icon={SearchIcon} title="Nothing found">Try fewer words, another spelling, or search all chapters.</Empty> : null}
          </>
        )}
      </div>
    </Frame>
  );
}
