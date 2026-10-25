import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Dialog, MOD, Segmented, Switch } from "./ui";
import { Sloka } from "./reading";
import { useVerse } from "../data/gita";
import { SCRIPTS } from "../lib/script";
import { setSetting } from "../state/store";
import { availableWordSources, DEFAULT_WORD_SOURCE } from "../../../src/lib/wordMeanings";

const THEMES = [
  { value: "auto", label: "System" },
  { value: "light", label: "Light" },
  { value: "sepia", label: "Sepia" },
  { value: "dark", label: "Dark" },
];

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <div className="field-label">
        <div className="t-strong t-small">{label}</div>
        {hint ? <div className="t-caption muted">{hint}</div> : null}
      </div>
      <div className="field-control">{children}</div>
    </div>
  );
}

export default function SettingsDialog({ open, onClose }) {
  const dispatch = useDispatch();
  const s = useSelector((st) => st.settings);
  const { data: sample } = useVerse(open ? 2 : null, open ? 47 : null);
  const set = (patch) => dispatch(setSetting(patch));
  const pct = Math.round(s.fontScale * 100);

  return (
    <Dialog open={open} onClose={onClose} title="Settings" width={720}>
      <div className="settings-preview">{sample ? <Sloka verse={sample} script={s.script} size={24 * s.fontScale} showIast={s.showIast} /> : <div style={{ height: 96 }} />}</div>

      <h3 className="settings-h">Reading</h3>
      <Field label="Sanskrit script" hint="How every verse and Sanskrit word is shown">
        <div className="script-grid">
          {SCRIPTS.map((sc) => (
            <button key={sc.key} type="button" className={`script-opt ${s.script === sc.key ? "on" : ""}`} onClick={() => set({ script: sc.key })} aria-pressed={s.script === sc.key} title={sc.name}>
              <span style={{ fontFamily: sc.font }}>{sc.label}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Text size" hint={`${pct}%`}>
        <div className="row" style={{ gap: 12, width: "100%" }}>
          <span className="t-small muted">A</span>
          <input
            type="range"
            className="slider"
            min={0.8}
            max={1.5}
            step={0.05}
            value={s.fontScale}
            style={{ "--v": `${((s.fontScale - 0.8) / 0.7) * 100}%` }}
            onChange={(e) => set({ fontScale: Number(e.target.value) })}
            aria-label="Text size"
          />
          <span className="t-heading muted">A</span>
        </div>
      </Field>
      <Field label="Theme">
        <Segmented value={s.theme} onChange={(theme) => set({ theme })} options={THEMES} label="Theme" />
      </Field>
      <Field label="Transliteration" hint="IAST under each verse">
        <Switch on={s.showIast} onChange={(x) => set({ showIast: x })} label="Transliteration" />
      </Field>
      <Field label="Padaccheda" hint="The verse with its words separated (Swami Nirvikalpananda)">
        <Switch on={s.showPadaccheda !== false} onChange={(x) => set({ showPadaccheda: x })} label="Padaccheda" />
      </Field>
      <Field label="Mark verses as read" hint="When you move on to the next verse">
        <Switch on={s.markReadOnMove} onChange={(x) => set({ markReadOnMove: x })} label="Mark verses as read" />
      </Field>

      <h3 className="settings-h">Word-by-word meanings</h3>
      <div className="list">
        {availableWordSources().map((src) => {
          const on = (s.wordSource || DEFAULT_WORD_SOURCE) === src.key;
          return (
            <button key={src.key} type="button" className="list-row" onClick={() => set({ wordSource: src.key })} aria-pressed={on}>
              <span className="grow">
                <span className="t-strong t-small">{src.name}</span>
                <span className="t-caption muted" style={{ display: "block" }}>
                  {src.lineage}
                </span>
              </span>
              {on ? <Check size={16} className="accent" /> : null}
            </button>
          );
        })}
      </div>
      <Field label="Telugu meanings" hint="Swami Nirvikalpananda's book is in Telugu">
        <Segmented
          value={s.teluguScript || "te"}
          onChange={(teluguScript) => set({ teluguScript })}
          label="Telugu meanings"
          options={[
            { value: "te", label: "As printed (తెలుగు)" },
            { value: "follow", label: "In my script" },
          ]}
        />
      </Field>

      <p className="t-caption muted" style={{ marginTop: 22 }}>
        Translations and commentaries come from many sources —{" "}
        <Link to="/about" className="link" onClick={onClose}>
          sources & credits
        </Link>
        . Keyboard: <span className="kbd">{MOD} K</span> search · <span className="kbd">←</span> <span className="kbd">→</span> previous / next verse · <span className="kbd">B</span> bookmark ·{" "}
        <span className="kbd">N</span> note.
      </p>
    </Dialog>
  );
}
