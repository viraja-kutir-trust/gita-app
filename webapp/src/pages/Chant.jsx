import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Pause, Play, X } from "lucide-react";
import { Blocks, Sloka } from "../components/reading";
import { IconButton, Segmented, Switch } from "../components/ui";
import { useChapterVerses, useTexts } from "../data/gita";
import { markRead, setSetting } from "../state/store";
import { toScript } from "../lib/script";
import { CHAPTERS, VERSE_COUNTS } from "../../../src/lib/names";
import { pickTranslation } from "../../../src/lib/texts";
import { editing } from "../App";

const SPEEDS = [
  { value: 0, label: "Off" },
  { value: 16, label: "Slow" },
  { value: 30, label: "Medium" },
  { value: 48, label: "Fast" },
];

/** Keep the screen on while chanting (Screen Wake Lock; Electron and modern browsers). */
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    let alive = true;
    const get = () =>
      navigator.wakeLock
        ?.request("screen")
        .then((l) => {
          if (alive) lock = l;
          else l.release();
        })
        .catch(() => {});
    get();
    const vis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", vis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", vis);
      lock?.release().catch(() => {});
    };
  }, []);
}

export default function Chant() {
  useWakeLock();
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const s = useSelector((st) => st.settings);
  const startChapter = Number(params.chapter) || 1;
  const [scope, setScope] = useState(s.chantScope || "chapter");
  const [speed, setSpeed] = useState(0);
  const [focus, setFocus] = useState(`${startChapter}.1`);
  const scroller = useRef(null);
  const chapters = useMemo(() => (scope === "book" ? CHAPTERS.slice(1).map((_, i) => i + 1) : [startChapter]), [scope, startChapter]);

  // Start at the chosen chapter in whole-book mode.
  useEffect(() => {
    const el = scroller.current?.querySelector(`[data-chapter-head="${startChapter}"]`);
    if (el) scroller.current.scrollTop = el.offsetTop - 40;
    else if (scroller.current) scroller.current.scrollTop = 0;
  }, [scope, startChapter]);

  // The verse at the middle of the window is "on"; passing one marks it read.
  const updateFocus = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    const mid = box.scrollTop + box.clientHeight * 0.45;
    let best = null;
    let bestD = Infinity;
    for (const el of box.querySelectorAll("[data-key]")) {
      const top = el.offsetTop;
      const d = mid < top ? top - mid : mid > top + el.offsetHeight ? mid - top - el.offsetHeight : 0;
      if (d < bestD) {
        bestD = d;
        best = el.dataset.key;
      }
      if (top > mid + 2000) break;
    }
    if (best) setFocus((f) => (f === best ? f : best));
  }, []);
  const lastFocus = useRef(null);
  useEffect(() => {
    if (lastFocus.current && lastFocus.current !== focus) dispatch(markRead(lastFocus.current));
    lastFocus.current = focus;
  }, [focus, dispatch]);

  // Auto-scroll.
  useEffect(() => {
    if (!speed) return undefined;
    let raf;
    let last = performance.now();
    let carry = 0;
    const step = (t) => {
      const box = scroller.current;
      carry += ((t - last) / 1000) * speed;
      last = t;
      if (box && carry >= 1) {
        const px = Math.floor(carry);
        carry -= px;
        box.scrollTop += px;
        if (box.scrollTop + box.clientHeight >= box.scrollHeight - 2) setSpeed(0);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  useEffect(() => {
    const key = (e) => {
      if (editing(document.activeElement)) return;
      if (e.key === "Escape") navigate(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setSpeed((x) => (x ? 0 : 30));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [navigate]);

  const [fc, fv] = focus.split(".").map(Number);
  const set = (patch) => dispatch(setSetting(patch));

  return (
    <div className="chant" data-theme="dark">
      <header className="chant-top">
        <IconButton icon={X} label="Exit chanting" keys={["Esc"]} onClick={() => navigate(-1)} />
        <div className="chant-title">
          <div className="t-strong">
            Chapter {fc} · {CHAPTERS[fc]?.name}
          </div>
          <div className="t-caption muted tnum">
            Verse {fv} of {VERSE_COUNTS[fc]}
          </div>
        </div>
        <Segmented
          value={scope}
          onChange={(x) => {
            setScope(x);
            set({ chantScope: x });
          }}
          label="Scope"
          options={[
            { value: "chapter", label: "This chapter" },
            { value: "book", label: "Whole Gita" },
          ]}
        />
      </header>

      <div className="chant-scroll" ref={scroller} onScroll={updateFocus}>
        <div className="chant-body">
          {chapters.map((c) => (
            <ChantChapter key={c} chapter={c} focus={focus} s={s} onLaidOut={updateFocus} />
          ))}
        </div>
      </div>

      <footer className="chant-bar">
        <button type="button" className="chant-play" onClick={() => setSpeed((x) => (x ? 0 : 30))} aria-label={speed ? "Stop auto-scroll" : "Start auto-scroll"}>
          {speed ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="grow">
          <div className="t-small t-strong">{speed ? "Scrolling" : "Press space to scroll and read along"}</div>
          <div className="t-caption muted">Keeps the screen awake while you chant</div>
        </div>
        <Segmented value={speed} onChange={setSpeed} options={SPEEDS} label="Scroll speed" />
        <label className="chant-toggle">
          <Switch on={s.chantShowIast} onChange={(x) => set({ chantShowIast: x })} label="Transliteration" /> Transliteration
        </label>
        <label className="chant-toggle">
          <Switch on={s.chantShowMeaning} onChange={(x) => set({ chantShowMeaning: x })} label="Meaning" /> Meaning
        </label>
      </footer>
    </div>
  );
}

function ChantChapter({ chapter, focus, s, onLaidOut }) {
  const { data: verses } = useChapterVerses(chapter);
  useEffect(() => {
    if (verses) requestAnimationFrame(onLaidOut);
  }, [verses, onLaidOut]);
  const meta = CHAPTERS[chapter];
  const sc = s.script === "ro" ? "dv" : s.script;
  return (
    <section className="chant-chapter">
      <div className="chant-head" data-chapter-head={chapter}>
        <div className="deva chant-ord">{toScript(`${meta.ordinal} · ${meta.sa}`, sc)}</div>
        <div className="t-small muted">
          Chapter {chapter} · {meta.name} · {VERSE_COUNTS[chapter]} verses
        </div>
      </div>
      {(verses || []).map((v) => (
        <ChantVerse key={v.id} v={v} on={focus === `${chapter}.${v.verse}`} s={s} />
      ))}
      <div className="chant-end deva">
        {toScript(`ॐ तत्सदिति श्रीमद्भगवद्गीतासूपनिषत्सु ब्रह्मविद्यायां योगशास्त्रे श्रीकृष्णार्जुनसंवादे ${meta.sa.replace(/ः$/, "ो")} नाम ${meta.ordinal} ॥`, sc)}
      </div>
    </section>
  );
}

/** One verse; its content mounts only near the viewport (the whole Gita is 701 verses). */
function ChantVerse({ v, on, s }) {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "1200px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`chant-verse ${on ? "on" : ""}`} data-key={`${v.chapter}.${v.verse}`} style={near ? null : { minHeight: 150 }}>
      {near ? (
        <>
          <Sloka verse={v} script={s.script} size={32 * s.fontScale} showIast={s.chantShowIast} />
          {s.chantShowMeaning ? <ChantMeaning v={v} s={s} /> : null}
        </>
      ) : null}
    </div>
  );
}

function ChantMeaning({ v, s }) {
  const { data } = useTexts(v.id, "translation");
  const tr = pickTranslation(data, s.primaryTranslatorId);
  return tr ? (
    <div className="chant-meaning">
      <Blocks blocks={tr.blocks} lang={tr.lang} size={16} />
    </div>
  ) : null;
}
