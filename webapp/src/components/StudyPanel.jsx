import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ChevronLeft, ChevronRight, Copy, MousePointerClick, Search, Share, Trash2, X } from "lucide-react";
import { setNote } from "../state/store";
import { combineEntries, describe } from "../lib/grammar";
import { fromTelugu, scriptFont, toScript, verseLines } from "../lib/script";
import { NOTE } from "../lib/study";
import { copyText, shareText } from "../lib/share";
import { CHAPTERS, parseVerseKey } from "../../../src/lib/names";
import { wordSourceInfo } from "../../../src/lib/wordMeanings";
import { IconButton } from "./ui";

/** What follows a shared note: the reference and the sloka in the reader's script. */
export function noteCite(key, verse, script) {
  const { chapter } = parseVerseKey(key);
  const ref = `— Bhagavad Gita ${key} · ${CHAPTERS[chapter]?.name || ""}`.trim();
  if (!verse) return ref;
  return `${ref}\n\n${verseLines(verse, script).map((l) => l.trim()).filter(Boolean).join("\n")}`;
}

/** Right-hand study panel on the verse page: the word inspector and the reader's note. */
export default function StudyPanel({ tab, onTab, verse, verseKey, words, selection, onSelect, script, teluguScript, onClose, toast }) {
  return (
    <aside className="verse-panel" aria-label="Study panel">
      <div className="panel-head">
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "word"} className={tab === "word" ? "on" : ""} onClick={() => onTab("word")}>
            Word study
          </button>
          <button type="button" role="tab" aria-selected={tab === "note"} className={tab === "note" ? "on" : ""} onClick={() => onTab("note")}>
            Your note
          </button>
        </div>
        <IconButton icon={X} label="Close panel" size={16} className="sm" onClick={onClose} />
      </div>
      <div className="panel-body">
        {tab === "word" ? (
          <WordInspector words={words} selection={selection} onSelect={onSelect} script={script} teluguScript={teluguScript} verseKey={verseKey} />
        ) : (
          <NoteEditor key={verseKey} verseKey={verseKey} verse={verse} script={script} toast={toast} />
        )}
      </div>
    </aside>
  );
}

function WordInspector({ words, selection, onSelect, script, teluguScript, verseKey }) {
  const navigate = useNavigate();
  const meanings = words?.meanings || [];
  const ids = selection ? [...new Set(selection.ids)].filter((k) => k >= 0 && k < meanings.length).sort((a, b) => a - b) : [];
  const m = ids.length > 1 ? combineEntries(ids.map((k) => meanings[k])) : meanings[ids[0]];
  const grammar = useMemo(() => {
    if (!m || !words) return [];
    return (m.dcsIdx || []).map((di) => words.words.find((w) => w.idx === di)).filter(Boolean);
  }, [m, words]);

  if (!words) return <div className="panel-empty"><div className="spinner" /></div>;
  if (!m) {
    return (
      <div className="panel-empty">
        <MousePointerClick size={26} strokeWidth={1.5} />
        <h3>Study a word</h3>
        <p>Click a word in the verse, the padaccheda or the word-by-word list to see its meaning, root and grammar.</p>
        <p className="t-caption faint">Words joined by sandhi open together.</p>
      </div>
    );
  }
  const first = ids[0];
  const last = ids[ids.length - 1];
  const step = (d) => onSelect([Math.max(0, Math.min(meanings.length - 1, (d < 0 ? first : last) + d))]);
  const telugu = words.lang === "telugu";
  const dev = m.termDev || "";
  const shown = script === "ro" ? null : toScript(dev, script);

  return (
    <div className="word">
      <div className="word-nav">
        <IconButton icon={ChevronLeft} label="Previous word" className="sm" disabled={first <= 0} onClick={() => step(-1)} />
        <span className="t-caption muted tnum">
          {ids.length > 1 ? `Words ${ids.map((k) => k + 1).join(", ")}` : `Word ${first + 1}`} of {meanings.length} · {verseKey}
        </span>
        <IconButton icon={ChevronRight} label="Next word" className="sm" disabled={last >= meanings.length - 1} onClick={() => step(1)} />
      </div>
      <div className="word-head">
        {shown ? (
          <div className="word-script" style={{ fontFamily: scriptFont(script) }} lang="sa">
            {shown}
          </div>
        ) : null}
        <div className={`iast ${shown ? "word-iast" : "word-script"}`}>{m.termIast}</div>
      </div>
      <div className="word-meaning" style={telugu ? { fontFamily: teluguScript === "te" ? "var(--font-telugu)" : scriptFont(teluguScript) } : null}>
        {telugu ? fromTelugu(m.meaning.replace(NOTE, ""), teluguScript) : m.meaning}
      </div>

      {grammar.map((w) => (
        <div key={w.idx} className="word-gram">
          {grammar.length > 1 ? <div className="t-eyebrow" style={{ margin: "4px 0 8px" }}>{w.unsandhied || w.form}</div> : null}
          <dl className="facts">
            <div className="fact">
              <dt>Root</dt>
              <dd>
                {script !== "ro" ? (
                  <span style={{ fontFamily: scriptFont(script) }} className="fact-sa">
                    {toScript(w.lemmaDev || "", script)}
                  </span>
                ) : null}
                <span className="iast">{w.lemma}</span>
              </dd>
            </div>
            {describe(w.morph).map((f, k) => (
              <div key={k} className="fact">
                <dt>{f.k}</dt>
                <dd>
                  <span>{f.v}</span>
                  {f.sa ? (
                    <span className="fact-sa accent" style={{ fontFamily: scriptFont(script) }}>
                      {toScript(f.sa, script)}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {grammar[0]?.lemma ? (
        <button type="button" className="btn word-more" onClick={() => navigate(`/search?q=${encodeURIComponent(grammar[0].lemma)}`)}>
          <Search size={14} /> Other verses with “{grammar[0].lemma}”
        </button>
      ) : null}
      <p className="t-caption faint word-credit">
        Meaning: {wordSourceInfo(words.source).name}
        {grammar.length ? " · Grammar: Digital Corpus of Sanskrit (O. Hellwig), CC BY 4.0" : ""}
      </p>
    </div>
  );
}

function NoteEditor({ verseKey, verse, script, toast }) {
  const dispatch = useDispatch();
  const saved = useSelector((s) => s.library.notes[verseKey]);
  const [text, setText] = useState(saved?.text || "");
  const timer = useRef(null);
  const ta = useRef(null);
  useEffect(() => {
    // Picks up text added from elsewhere (e.g. "Note" on a highlight) while not typing here.
    if (document.activeElement !== ta.current) setText(saved?.text || "");
  }, [saved?.text]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    ta.current?.focus();
  }, []);
  const change = (t) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => dispatch(setNote({ key: verseKey, text: t })), 400);
  };
  const message = () => `${text.trim()}\n\n${noteCite(verseKey, verse, script)}`.trim();
  return (
    <div className="note">
      <textarea
        ref={ta}
        className="note-area"
        value={text}
        onChange={(e) => change(e.target.value)}
        onBlur={() => dispatch(setNote({ key: verseKey, text }))}
        placeholder={`Your reflection on ${verseKey}…`}
        aria-label={`Note on verse ${verseKey}`}
      />
      <div className="note-foot">
        <span className="t-caption faint">{saved ? `Saved · ${new Date(saved.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : "Saved automatically"}</span>
        <span className="grow" />
        <IconButton
          icon={Copy}
          label="Copy note with verse"
          className="sm"
          size={15}
          disabled={!text.trim()}
          onClick={async () => {
            await copyText(message());
            toast("Copied note with the verse");
          }}
        />
        <IconButton icon={Share} label="Share note" className="sm" size={15} disabled={!text.trim()} onClick={() => shareText(message(), toast)} />
        <IconButton
          icon={Trash2}
          label="Delete note"
          className="sm"
          size={15}
          disabled={!saved}
          onClick={() => {
            setText("");
            dispatch(setNote({ key: verseKey, text: "" }));
          }}
        />
      </div>
    </div>
  );
}
