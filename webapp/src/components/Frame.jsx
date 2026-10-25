import { Fragment, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, PanelLeft, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setSetting } from "../state/store";
import { useScrollMemory } from "../lib/nav";
import { IconButton, isMac, MOD } from "./ui";

/**
 * A page: the top bar (sidebar toggle, back, breadcrumbs, actions, close) and the
 * scrolling content, which remembers its scroll position per page.
 * crumbs: [{label, to}] — the last one is the current page.
 * close: {label, onClick} — a close button at the right end (detail views).
 * Pages that scroll inner panes themselves pass className "no-scroll".
 */
export default function Frame({ crumbs = [], actions, close, children, className = "" }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarOpen = useSelector((s) => s.settings.sidebarOpen !== false);
  const content = useRef(null);
  const canGoBack = (window.history.state?.idx ?? 0) > 0;
  useScrollMemory(content, className.includes("no-scroll") ? null : location.pathname + location.search);
  return (
    <>
      <header className="topbar">
        {!sidebarOpen ? <IconButton icon={PanelLeft} label="Show sidebar" keys={[MOD, "\\"]} onClick={() => dispatch(setSetting({ sidebarOpen: true }))} /> : null}
        <IconButton icon={ArrowLeft} label="Back" keys={isMac ? ["⌘", "["] : ["Alt", "←"]} disabled={!canGoBack} onClick={() => navigate(-1)} />
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 ? <ChevronRight size={14} /> : null}
              {i < crumbs.length - 1 && c.to ? (
                <Link to={c.to} className="ellipsis">
                  {c.label}
                </Link>
              ) : (
                <span className="here ellipsis">{c.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
        {actions || close ? (
          <div className="topbar-actions">
            {actions}
            {close ? (
              <>
                {actions ? <span className="divider" /> : null}
                <button type="button" className="btn sm close-btn" onClick={close.onClick} aria-label={close.label}>
                  <X size={15} /> {close.text || "Close"} <span className="kbd">Esc</span>
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className={`content ${className}`} ref={content}>
        {children}
      </div>
    </>
  );
}
