import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Copy, MessageSquarePlus, Share, Trash2 } from "lucide-react";
import { setNote } from "../state/store";
import { copyText, shareText } from "../lib/share";
import { noteCite } from "./StudyPanel";
import { Dialog, IconButton, useToast } from "./ui";

const when = (t) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * The reader's note on a verse, as a card in the right margin (like a comment in a
 * document). It never grows taller than its container (the verse); a longer note
 * fades out and opens in full in a dialog.
 */
export function NoteCard({ verseKey, onOpen }) {
  const note = useSelector((s) => s.library.notes[verseKey]);
  const body = useRef(null);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return undefined;
    const check = () => setClipped(el.scrollHeight > el.clientHeight + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [note?.text]);
  if (!note) return null;
  return (
    <button type="button" className={`note-card ${clipped ? "clipped" : ""}`} onClick={onOpen} aria-label={`Your note on ${verseKey}. Open`}>
      <span className="note-card-head">
        <span className="note-card-dot" />
        Your note
        <span className="note-card-date">{new Date(note.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
      </span>
      <span className="note-card-body" ref={body}>
        {note.text}
      </span>
      {clipped ? <span className="note-card-more">Show all</span> : null}
    </button>
  );
}

/** "Add a note" in the margin, for verses without one. */
export function AddNote({ onOpen }) {
  return (
    <button type="button" className="note-add" onClick={onOpen}>
      <MessageSquarePlus size={15} strokeWidth={1.75} /> Add note
    </button>
  );
}

/** The whole note in a dialog: read, edit (saved as you type), copy, share, delete. */
export function NoteDialog({ verseKey, verse, script, open, onClose }) {
  const dispatch = useDispatch();
  const toast = useToast();
  const saved = useSelector((s) => s.library.notes[verseKey]);
  const [text, setText] = useState("");
  const timer = useRef(null);
  useEffect(() => {
    if (open) setText(saved?.text || "");
  }, [open, verseKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (t) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => dispatch(setNote({ key: verseKey, text: t })), 400);
  };
  const close = () => {
    clearTimeout(timer.current);
    dispatch(setNote({ key: verseKey, text }));
    onClose();
  };
  const message = () => `${text.trim()}\n\n${noteCite(verseKey, verse, script)}`.trim();
  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Your note · ${verseKey}`}
      width={640}
      footer={
        <div className="dialog-foot">
          <span className="t-caption faint">{saved ? `Saved · ${when(saved.updatedAt)}` : "Saved automatically"}</span>
          <span className="grow" />
          <IconButton
            icon={Copy}
            label="Copy note with verse"
            size={15}
            disabled={!text.trim()}
            onClick={async () => {
              await copyText(message());
              toast("Copied note with the verse");
            }}
          />
          <IconButton icon={Share} label="Share note" size={15} disabled={!text.trim()} onClick={() => shareText(message(), toast)} />
          <IconButton
            icon={Trash2}
            label="Delete note"
            size={15}
            disabled={!saved && !text}
            onClick={() => {
              setText("");
              dispatch(setNote({ key: verseKey, text: "" }));
              onClose();
            }}
          />
          <button type="button" className="btn primary sm" onClick={close} style={{ marginLeft: 8 }}>
            Done
          </button>
        </div>
      }
    >
      <textarea
        className="note-area note-dialog-area"
        value={text}
        onChange={(e) => change(e.target.value)}
        placeholder={`Your reflection on ${verseKey}…`}
        aria-label={`Note on verse ${verseKey}`}
        autoFocus
      />
    </Dialog>
  );
}
