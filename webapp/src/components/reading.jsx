import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { blockPlain, buildRuns, locateHighlight, sourceOffset } from "../lib/text";
import { convertDeva, fromTelugu, LANG_FONT, scriptDigits, scriptFont, verseLines } from "../lib/script";
import { Popover } from "./ui";

// ---------------------------------------------------------------- sloka
const PUNCT = /^[।॥|]+$/;
const DIGITS = /^[०-९0-9౦-౯೦-೯൦-൯০-৯૦-૯]+$/;
const tokensOf = (line) => line.split(/[ \t\n]+/).filter(Boolean);

/**
 * The sloka, one printed line per half-verse/pāda. Every line shares one size,
 * scaled so the widest fits the column (between 70% and 115% of `size`).
 * Words are buttons when `onWord` is given (index counts words only, as on phones).
 */
export const Sloka = memo(function Sloka({ verse, script = "dv", size = 30, showIast = true, onWord, activeTokens, align = "center", showNumber = true, className = "" }) {
  const box = useRef(null);
  const [scale, setScale] = useState(1);
  const lines = useMemo(() => verseLines(verse, script), [verse, script]);
  const sig = `${script}|${size}|${lines.join("\n")}`;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    let cur = scale;
    const fit = () => {
      const inners = el.querySelectorAll(".sloka-inner");
      if (!inners.length) return;
      const widest = Math.max(...[...inners].map((n) => n.offsetWidth)) / cur;
      const avail = el.clientWidth * 0.98;
      const next = Math.max(0.7, Math.min(1.15, avail / widest));
      if (Math.abs(next - cur) > 0.005) {
        cur = next;
        setScale(next);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!verse) return null;
  const font = scriptFont(script);
  const speaker = verse.speaker ? (script === "ro" ? verse.speakerIast || verse.speaker : convertDeva(verse.speaker, script)) : null;
  const speakerAt = verse.speaker ? verse.speakerPosition || 0 : -1;
  const px = size * scale;
  let tokenIndex = -1;

  return (
    <div className={`sloka ${className}`} ref={box} style={{ textAlign: align }} lang="sa">
      {lines.map((line, li) => {
        const padaIdx = verse.meter === "anushtubh" ? li * 2 : li;
        const toks = tokensOf(line.replace(/[\s।॥|]+$/, (m) => (li === lines.length - 1 && showNumber ? "" : m)));
        const lastLine = li === lines.length - 1;
        return (
          <Fragment key={li}>
            {speakerAt === padaIdx ? (
              <div className="sloka-speaker" style={{ fontFamily: font, fontSize: Math.round(size * 0.58) }}>
                {speaker}
              </div>
            ) : null}
            <div className="sloka-line" style={{ fontFamily: font, fontSize: px }}>
              <span className="sloka-inner">
                {toks.map((tok, ti) => {
                  const sep = ti < toks.length - 1 ? " " : "";
                  if (PUNCT.test(tok) || DIGITS.test(tok) || !onWord) return <Fragment key={ti}>{tok + sep}</Fragment>;
                  tokenIndex += 1;
                  const my = tokenIndex;
                  return (
                    <Fragment key={ti}>
                      <button type="button" className={`w ${activeTokens?.has(my) ? "on" : ""}`} onClick={() => onWord(my)}>
                        {tok}
                      </button>
                      {sep}
                    </Fragment>
                  );
                })}
                {lastLine && showNumber ? <span className="sloka-num">{` ॥ ${scriptDigits(verse.verse, script)} ॥`}</span> : null}
              </span>
            </div>
          </Fragment>
        );
      })}
      {showIast && script !== "ro" ? (
        <div className="sloka-iast" style={{ fontSize: Math.max(14, Math.round(size * 0.56)) }}>
          {verse.iastLines.map((l, i) => (
            <div key={i}>{l.replace(/\s*\|\|\s*$/, "").replace(/\s*\|\s*$/, "")}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

// ---------------------------------------------------------------- footnotes
export function FootnoteMark({ n, note, font, render }) {
  const [anchor, setAnchor] = useState(null);
  const close = useCallback(() => setAnchor(null), []);
  return (
    <>
      <button type="button" className="fn" aria-label={`Footnote ${n}`} onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
        {n}
      </button>
      <Popover anchor={anchor} open={!!anchor && !!note} onClose={close} align="center" width={360} className="fn-pop">
        <div className="fn-pop-head">Note {n}</div>
        <div className="fn-pop-body" style={{ fontFamily: font }}>
          {render ? render(note?.text || "") : note?.text}
        </div>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------- text blocks
/**
 * Translation / commentary text. With `onSelect`, selecting words reports
 * {block, start, end, quote, occurrence, rect} (offsets in the block's plain text,
 * the same as the phone app stores for highlights); clicking a saved highlight
 * reports {highlightId, rect}.
 */
export const Blocks = memo(function Blocks({
  blocks,
  lang = "english",
  script = "dv",
  teluguScript = "te",
  size = 18,
  highlights,
  onSelect,
  terms,
  currentMatch = -1,
  className = "",
  font,
}) {
  const root = useRef(null);
  const teConv = lang === "telugu" && teluguScript !== "te";
  const conv = useCallback((t) => (teConv ? fromTelugu(t, teluguScript) : convertDeva(t, script)), [teConv, teluguScript, script]);
  const baseFont = font || (teConv ? scriptFont(teluguScript) : script !== "dv" && (lang === "sanskrit" || lang === "hindi") ? scriptFont(script) : LANG_FONT[lang] || "var(--font-serif)");
  const noteItems = useMemo(() => (blocks || []).filter((b) => b.type === "footnotes").flatMap((b) => b.items || []), [blocks]);
  const counter = { n: 0 };

  const built = (blocks || []).map((b, i) => {
    if (b.type === "footnotes") return null;
    const raw = b.type === "verse_quote" ? b.lines.join("\n") : b.text || "";
    const plainForHl = blockPlain(b);
    const hlRanges = (highlights || [])
      .filter((h) => h.block === i)
      .map((h) => {
        const r = locateHighlight(plainForHl, h);
        return r ? { start: r[0], end: r[1], color: h.color || "yellow", id: h.id } : null;
      })
      .filter(Boolean);
    return { b, i, ...buildRuns(raw, { terms, counter, currentMatch, hlRanges }) };
  });

  // Selection → block offsets.
  useEffect(() => {
    if (!onSelect) return undefined;
    const el = root.current;
    const locate = (node, offset) => {
      const host = node.nodeType === 1 ? node : node.parentElement;
      const runEl = host?.closest?.("[data-run]");
      if (!runEl || !el.contains(runEl)) return null;
      const blockEl = runEl.closest("[data-block]");
      const bi = Number(blockEl.dataset.block);
      const ri = Number(runEl.dataset.run);
      const r = document.createRange();
      r.setStart(runEl, 0);
      r.setEnd(node, offset);
      const into = r.toString().length;
      const item = built.find((x) => x && x.i === bi);
      return item ? { bi, pos: sourceOffset(item.runs[ri], conv, into), item } : null;
    };
    const onUp = (e) => {
      if (e.button !== 0) return;
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!el.contains(range.commonAncestorContainer)) return;
        const a = locate(range.startContainer, range.startOffset);
        const z = locate(range.endContainer, range.endOffset);
        if (!a) return;
        const end = z && z.bi === a.bi ? z.pos : a.item.plain.length;
        const quote = a.item.plain.slice(a.pos, end);
        if (!quote.trim()) return;
        let occurrence = 0;
        for (let at = a.item.plain.indexOf(quote); at >= 0 && at < a.pos; at = a.item.plain.indexOf(quote, at + 1)) occurrence++;
        onSelect({ block: a.bi, start: a.pos, end, quote, occurrence, rect: range.getBoundingClientRect() });
      }, 0);
    };
    el.addEventListener("mouseup", onUp);
    return () => el.removeEventListener("mouseup", onUp);
  });

  return (
    <div ref={root} className={`prose ${className}`} style={{ "--size": `${size}px`, fontFamily: baseFont }} lang={lang === "english" ? "en" : undefined}>
      {built.map((x) => {
        if (!x) return null;
        const { b, i, runs, notes } = x;
        const children = [];
        runs.forEach((r, k) => {
          for (const [p, n] of notes) if (p === r.start && !runs.some((q) => q.end === p)) children.push(<FootnoteMark key={`m${k}-${n}`} n={n} note={noteItems.find((f) => f.n === n)} font={baseFont} render={conv} />);
          const cls = [r.bold && "pratika", r.hl && `hl hl-${r.hl}`, r.mark != null && (r.mark === currentMatch ? "mark current" : "mark")].filter(Boolean).join(" ");
          children.push(
            <span
              key={k}
              data-run={k}
              className={cls || undefined}
              data-mark={r.mark ?? undefined}
              onClick={
                r.hlId && onSelect
                  ? (e) => {
                      if (!window.getSelection()?.isCollapsed) return;
                      onSelect({ highlightId: r.hlId, rect: e.currentTarget.getBoundingClientRect() });
                    }
                  : undefined
              }
            >
              {conv(r.src)}
            </span>
          );
          for (const [p, n] of notes) if (p === r.end) children.push(<FootnoteMark key={`e${k}-${n}`} n={n} note={noteItems.find((f) => f.n === n)} font={baseFont} render={conv} />);
        });
        if (!runs.length) for (const [, n] of notes) children.push(<FootnoteMark key={`x${n}`} n={n} note={noteItems.find((f) => f.n === n)} font={baseFont} render={conv} />);
        if (b.type === "heading")
          return (
            <h4 key={i} data-block={i} className="prose-h">
              {children}
            </h4>
          );
        if (b.type === "verse_quote")
          return (
            <figure key={i} className="prose-quote">
              <div data-block={i} style={{ fontFamily: scriptFont(script) }}>
                {children}
              </div>
              {b.ref ? <figcaption>{b.ref}</figcaption> : null}
            </figure>
          );
        return (
          <p key={i} data-block={i}>
            {b.label ? <span className="prose-label">{b.label} </span> : null}
            {children}
          </p>
        );
      })}
      {noteItems.length ? (
        <details className="prose-notes">
          <summary>
            {noteItems.length} {noteItems.length === 1 ? "footnote" : "footnotes"}
          </summary>
          <ol>
            {noteItems.map((f) => (
              <li key={f.n} value={f.n}>
                {conv(f.text)}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
});
