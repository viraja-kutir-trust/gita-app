import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Copy, Eye, EyeOff, MoreHorizontal, Star } from "lucide-react";
import Frame from "../components/Frame";
import { Blocks, Sloka } from "../components/reading";
import { Chip, IconButton, Menu, Segmented, Skeleton, useToast } from "../components/ui";
import { useTexts, useVerse, useWordMeanings } from "../data/gita";
import { setSetting, toggleHiddenTranslator } from "../state/store";
import { plainText } from "../lib/text";
import { copyText } from "../lib/share";
import { toScript } from "../lib/script";
import { authorName, CHAPTERS, LANGS } from "../../../src/lib/names";
import { orderTranslations } from "../../../src/lib/texts";
import { useCloseToVerse } from "../lib/nav";

const STOP = new Set(["the", "a", "an", "of", "in", "on", "to", "and", "or", "by", "with", "for", "from", "at", "is", "be", "your", "my", "his", "their", "its", "all", "one", "who", "not", "never", "only", "certainly", "indeed", "o"]);

/** Search terms that find how each translator rendered a Sanskrit word (as on phones). */
function traceTerms(m, lemmaDev) {
  const en = (m.meaning || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, w.length - 2) : w.replace(/s$/, "")));
  const dev = lemmaDev ? [lemmaDev.replace(/्$/, "")] : [];
  const te = lemmaDev ? [toScript(lemmaDev.replace(/्$/, ""), "te")] : [];
  return [...new Set([...en, ...dev, ...te])].filter((t) => t.length >= 2);
}

export default function Translations() {
  const { c, v } = useParams();
  const chapter = Number(c);
  const vn = Number(v);
  const dispatch = useDispatch();
  const toast = useToast();
  const s = useSelector((st) => st.settings);
  const { data: verse } = useVerse(chapter, vn);
  const { data: texts } = useTexts(verse?.id, "translation");
  const { data: words } = useWordMeanings(verse);
  const [lang, setLang] = useState("all");
  const [trace, setTrace] = useState(null);
  const [mode, setMode] = useState("read");
  const manage = mode === "manage";
  const close = useCloseToVerse(chapter, vn);

  const shown = useMemo(() => {
    const all = manage ? (texts || []).slice().sort((a, b) => a.authorId - b.authorId) : orderTranslations(texts, { primaryId: s.primaryTranslatorId, order: s.translatorOrder, hidden: s.hiddenTranslators });
    return lang === "all" ? all : all.filter((t) => t.lang === lang);
  }, [texts, s.primaryTranslatorId, s.translatorOrder, s.hiddenTranslators, lang, manage]);
  const langCounts = useMemo(() => {
    const m = {};
    for (const t of texts || []) m[t.lang] = (m[t.lang] || 0) + 1;
    return m;
  }, [texts]);
  const traceable = useMemo(() => {
    if (!words) return [];
    return words.meanings
      .map((m, i) => ({ i, m, w: words.words.find((x) => m.dcsIdx?.includes(x.idx)) }))
      .filter(({ w }) => w && ["noun", "verb", "adjective"].includes(w.pos))
      .slice(0, 8);
  }, [words]);
  const terms = trace != null && traceable[trace] ? traceTerms(traceable[trace].m, traceable[trace].w?.lemmaDev) : null;

  return (
    <Frame
      crumbs={[
        { label: `${chapter} · ${CHAPTERS[chapter].name}`, to: `/chapter/${chapter}` },
        { label: `Verse ${vn}`, to: `/verse/${chapter}/${vn}` },
        { label: "Translations" },
      ]}
      close={{ label: `Close, back to verse ${chapter}.${vn}`, text: `Back to ${chapter}.${vn}`, onClick: close }}
      actions={
        <Segmented
          value={mode}
          onChange={setMode}
          label="Mode"
          options={[
            { value: "read", label: "Compare" },
            { value: "manage", label: "Choose & hide" },
          ]}
        />
      }
    >
      <div className="page">
        <div className="compare-head">
          {verse ? <Sloka verse={verse} script={s.script} size={22} showIast={false} align="left" /> : <Skeleton h={60} />}
          <div className="compare-filters">
            <div className="chips">
              <Chip on={lang === "all"} n={texts?.length} onClick={() => setLang("all")}>
                All
              </Chip>
              {Object.entries(langCounts).map(([l, n]) => (
                <Chip key={l} on={lang === l} n={n} onClick={() => setLang(l)}>
                  {LANGS[l]?.label || l}
                </Chip>
              ))}
            </div>
            {!manage && traceable.length ? (
              <div className="trace">
                <span className="t-caption muted">Trace a word across translations</span>
                <div className="chips">
                  {traceable.map((t, k) => (
                    <Chip key={k} on={trace === k} onClick={() => setTrace(trace === k ? null : k)} title={`${t.m.termIast} — ${t.m.meaning}`}>
                      <span style={{ fontFamily: "var(--font-deva)" }}>{toScript(t.m.termDev, s.script === "ro" ? "dv" : s.script) || t.m.termIast}</span>
                    </Chip>
                  ))}
                </div>
                {trace != null ? (
                  <span className="t-caption muted">
                    <i className="serif">{traceable[trace].m.termIast}</i> — {traceable[trace].m.meaning}
                  </span>
                ) : null}
              </div>
            ) : null}
            {manage ? <p className="t-small muted">Choose which translation shows first on every verse, and hide the ones you don't read.</p> : null}
          </div>
        </div>

        <div className={manage ? "list" : "compare-grid"}>
          {texts
            ? shown.map((t) => {
                const name = authorName(t.authorId, t.authorName);
                const primary = t.authorId === s.primaryTranslatorId;
                const hidden = s.hiddenTranslators.includes(t.authorId);
                if (manage) {
                  return (
                    <div key={t.id} className="list-row">
                      <span className="grow">
                        <span className="t-strong">{name}</span>
                        <span className="t-caption muted" style={{ display: "block" }}>
                          {LANGS[t.lang]?.label || t.lang}
                          {primary ? " · shown first" : hidden ? " · hidden" : ""}
                        </span>
                      </span>
                      <button type="button" className={`btn sm ${primary ? "primary" : ""}`} onClick={() => dispatch(setSetting({ primaryTranslatorId: t.authorId }))} disabled={primary}>
                        <Star size={13} /> {primary ? "Default" : "Make default"}
                      </button>
                      <IconButton icon={hidden ? EyeOff : Eye} label={hidden ? "Show in comparisons" : "Hide from comparisons"} disabled={primary} onClick={() => dispatch(toggleHiddenTranslator(t.authorId))} />
                    </div>
                  );
                }
                return (
                  <article key={t.id} className={`card compare-card ${primary ? "primary" : ""}`}>
                    <header className="row" style={{ justifyContent: "space-between" }}>
                      <span>
                        <span className="t-strong">{name}</span>
                        <span className="t-caption muted"> · {LANGS[t.lang]?.label || t.lang}</span>
                      </span>
                      <span className="row" style={{ gap: 2 }}>
                        {primary ? <span className="badge">Default</span> : null}
                        <Menu
                          trigger={(o) => <IconButton icon={MoreHorizontal} label="More actions" className="sm" size={15} onClick={o} />}
                          items={[
                            {
                              label: "Copy",
                              icon: Copy,
                              onSelect: async () => {
                                await copyText(`${plainText(t.blocks)}\n\n— ${name}, Bhagavad Gita ${chapter}.${vn}`);
                                toast("Copied");
                              },
                            },
                            !primary && { label: "Make default translation", icon: Star, onSelect: () => dispatch(setSetting({ primaryTranslatorId: t.authorId })) },
                            !primary && { label: "Hide from comparisons", icon: EyeOff, onSelect: () => dispatch(toggleHiddenTranslator(t.authorId)) },
                          ]}
                        />
                      </span>
                    </header>
                    <Blocks blocks={t.blocks} lang={t.lang} size={16.5 * s.fontScale} terms={terms} teluguScript={s.teluguScript === "follow" ? s.script : "te"} />
                  </article>
                );
              })
            : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={120} />)}
        </div>
      </div>
    </Frame>
  );
}
