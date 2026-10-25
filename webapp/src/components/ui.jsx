import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = isMac ? "⌘" : "Ctrl";

// ---------------------------------------------------------------- tooltip
const TipContext = createContext(() => {});

export function TooltipLayer({ children }) {
  const [tip, setTip] = useState(null);
  return (
    <TipContext.Provider value={setTip}>
      {children}
      {tip ? createPortal(<TooltipBubble {...tip} />, document.body) : null}
    </TipContext.Provider>
  );
}

function TooltipBubble({ rect, label, keys }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -999, top: -999 });
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth || 0;
    const left = Math.min(window.innerWidth - w - 8, Math.max(8, rect.left + rect.width / 2 - w / 2));
    const below = rect.bottom + 8;
    setPos({ left, top: below + 30 > window.innerHeight ? rect.top - 34 : below });
  }, [rect]);
  return (
    <div ref={ref} className="tooltip" style={pos} role="tooltip">
      {label}
      {keys ? keys.map((k) => <span key={k} className="kbd">{k}</span>) : null}
    </div>
  );
}

/** Hover/focus tooltip for any element (label + optional key hints). */
export function useTooltip(label, keys) {
  const set = useContext(TipContext);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!label) return {};
  const show = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => set({ rect, label, keys }), 450);
  };
  const hide = () => {
    clearTimeout(timer.current);
    set(null);
  };
  return { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide, onMouseDown: hide };
}

export function IconButton({ icon: I, label, keys, on, size = 17, className = "", ...rest }) {
  const tip = useTooltip(label, keys);
  return (
    <button type="button" className={`icon-btn ${on ? "on" : ""} ${className}`} aria-label={label} aria-pressed={on === undefined ? undefined : on} {...tip} {...rest}>
      <I size={size} strokeWidth={1.75} />
    </button>
  );
}

export function Kbd({ children }) {
  return <span className="kbd">{children}</span>;
}

// ---------------------------------------------------------------- toast
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastLayer({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setToast({ text, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast
        ? createPortal(
            <div key={toast.id} className="toast" role="status">
              <CheckCircle2 size={16} />
              {toast.text}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------- popover / menu
/** A floating panel anchored to an element (or a rect); closes on outside click and Esc. */
export function Popover({ anchor, open, onClose, children, align = "end", width, className = "" }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    const el = ref.current;
    const w = el?.offsetWidth || width || 220;
    const h = el?.offsetHeight || 200;
    let left = align === "start" ? r.left : align === "center" ? r.left + r.width / 2 - w / 2 : r.right - w;
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    setPos({ left, top });
  }, [open, anchor, align, width]);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !(anchor?.contains && anchor.contains(e.target))) onClose();
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", down);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key, true);
    };
  }, [open, anchor, onClose]);
  if (!open) return null;
  return createPortal(
    <div ref={ref} className={`popover ${className}`} style={{ ...(pos || { left: -9999, top: -9999 }), width }}>
      {children}
    </div>,
    document.body
  );
}

/** "⋯" style menu: items [{label, icon, onSelect, danger} | "sep"]. */
export function Menu({ items, trigger }) {
  const [anchor, setAnchor] = useState(null);
  const close = useCallback(() => setAnchor(null), []);
  return (
    <>
      {trigger((e) => setAnchor(anchor ? null : e.currentTarget))}
      <Popover anchor={anchor} open={!!anchor} onClose={close}>
        <div role="menu">
          {items.filter(Boolean).map((it, i) =>
            it === "sep" ? (
              <div key={i} className="menu-sep" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={`menu-item ${it.danger ? "danger" : ""}`}
                onClick={() => {
                  close();
                  it.onSelect();
                }}
              >
                {it.icon ? <it.icon size={15} strokeWidth={1.75} /> : null}
                {it.label}
              </button>
            )
          )}
        </div>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------- dialog
export function Dialog({ open, onClose, title, children, width, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} style={width ? { width: `min(${width}px, calc(100vw - 48px))` } : null}>
        {title ? (
          <div className="dialog-head">
            <h2 className="t-heading">{title}</h2>
            <IconButton icon={X} label="Close" keys={["Esc"]} onClick={onClose} />
          </div>
        ) : null}
        <div className="dialog-body">{children}</div>
        {footer}
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------- small controls
export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)} style={o.style}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} />;
}

export function Chip({ on, children, n, ...rest }) {
  return (
    <button type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} {...rest}>
      {children}
      {n != null ? <span className="n">{n}</span> : null}
    </button>
  );
}

export function Empty({ icon: I, title, children }) {
  return (
    <div className="empty">
      {I ? <I size={28} strokeWidth={1.5} /> : null}
      <h3>{title}</h3>
      <p className="t-small">{children}</p>
    </div>
  );
}

export function Bar({ value, label }) {
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Skeleton({ h = 14, w = "100%", style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}
