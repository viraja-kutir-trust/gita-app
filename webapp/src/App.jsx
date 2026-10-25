import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Sidebar from "./components/Sidebar";
import CommandPalette from "./components/CommandPalette";
import SettingsDialog from "./components/SettingsDialog";
import { ToastLayer, TooltipLayer } from "./components/ui";
import { setSetting } from "./state/store";
import { useTrackReading } from "./lib/nav";
import Today from "./pages/Today";
import Chapters from "./pages/Chapters";
import Chapter from "./pages/Chapter";
import Verse from "./pages/Verse";
import Commentary from "./pages/Commentary";
import Translations from "./pages/Translations";
import Search from "./pages/Search";
import Library from "./pages/Library";
import Chant from "./pages/Chant";
import Reader from "./pages/Reader";
import About from "./pages/About";

function useTheme() {
  const theme = useSelector((s) => s.settings.theme);
  const scale = useSelector((s) => s.settings.fontScale);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme = theme && theme !== "auto" ? theme : mq.matches ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty("--scale", String(scale || 1));
  }, [scale]);
}

export const editing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export default function App() {
  useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarOpen = useSelector((s) => s.settings.sidebarOpen !== false);
  const [palette, setPalette] = useState(false);
  const [settings, setSettings] = useState(false);
  const immersive = location.pathname.startsWith("/chant");
  useTrackReading(location);

  useEffect(() => {
    const key = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (mod && e.key === ",") {
        e.preventDefault();
        setSettings(true);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        dispatch(setSetting({ sidebarOpen: !sidebarOpen }));
      } else if (e.key === "/" && !editing(document.activeElement) && !mod) {
        e.preventDefault();
        setPalette(true);
      } else if (window.gitaDesktop) {
        // the desktop app's Go menu handles ⌘[ / ⌘] (Alt+←/→ on Windows)
      } else if (mod && e.key === "[") {
        e.preventDefault();
        navigate(-1);
      } else if (mod && e.key === "]") {
        e.preventDefault();
        navigate(1);
      }
    };
    const mouse = (e) => {
      if (e.button === 3) navigate(-1);
      if (e.button === 4) navigate(1);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("mouseup", mouse);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("mouseup", mouse);
    };
  }, [dispatch, navigate, sidebarOpen]);

  return (
    <TooltipLayer>
      <ToastLayer>
        <div className={`shell ${sidebarOpen && !immersive ? "" : "no-sidebar"}`}>
          <Sidebar onSearch={() => setPalette(true)} onSettings={() => setSettings(true)} />
          <main className="main">
            <Routes>
              <Route path="/" element={<Today onSettings={() => setSettings(true)} />} />
              <Route path="/chapters" element={<Chapters />} />
              <Route path="/chapter/:n" element={<Chapter />} />
              <Route path="/verse/:c/:v" element={<Verse onSettings={() => setSettings(true)} />} />
              <Route path="/verse/:c/:v/commentary/:author?" element={<Commentary />} />
              <Route path="/verse/:c/:v/translations" element={<Translations />} />
              <Route path="/search" element={<Search />} />
              <Route path="/library/:tab?" element={<Library />} />
              <Route path="/read/:chapter?" element={<Reader onSettings={() => setSettings(true)} />} />
              <Route path="/chant/:chapter?" element={<Chant />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<Today onSettings={() => setSettings(true)} />} />
            </Routes>
          </main>
        </div>
        <CommandPalette open={palette} onClose={() => setPalette(false)} />
        <SettingsDialog open={settings} onClose={() => setSettings(false)} />
      </ToastLayer>
    </TooltipLayer>
  );
}
