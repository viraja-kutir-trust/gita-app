import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useSelector } from "react-redux";
import { whenGita } from "../data/gita";
import { nextVerse } from "../lib/names";
import { AUDIO_ENABLED } from "../lib/features";

/**
 * One app-wide recitation player. Audio is streamed per verse (nothing is
 * stored on the device) and can continue verse after verse:
 *   mode "single"  – stop after this verse (unless "Play next verse automatically" is on)
 *   mode "chapter" – continue to the end of the chapter
 *   mode "book"    – continue through the whole Gita
 */
const AudioContext = createContext(null);
// Playback position changes 4×/second; it lives in its own context so only the
// progress bars re-render, not every screen that shows a play button.
const ProgressContext = createContext({ currentTime: 0, duration: 0 });

export function AudioProvider({ children }) {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const autoPlayNext = useSelector((s) => s.settings.autoPlayNext);
  const [current, setCurrent] = useState(null); // {chapter, verse, mode}
  const [error, setError] = useState(null);
  const repeatLeft = useRef(0);
  const repeatTotal = useRef(1);
  const triedFallback = useRef(false);
  const urls = useRef(null);
  const handledFinish = useRef(false);

  useEffect(() => {
    if (!AUDIO_ENABLED) return;
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" }).catch(() => {});
  }, []);

  const load = useCallback(
    async (chapter, verse, mode = "single", { repeat } = {}) => {
      setError(null);
      triedFallback.current = false;
      handledFinish.current = false;
      if (repeat != null) repeatTotal.current = Math.max(1, repeat);
      repeatLeft.current = repeatTotal.current - 1;
      setCurrent({ chapter, verse, mode });
      const gita = await whenGita();
      const info = await gita.getAudioUrl(chapter, verse);
      if (!info) {
        setError("No recitation is available for this verse.");
        return;
      }
      urls.current = info;
      player.replace({ uri: info.url });
      player.play();
      try {
        player.setActiveForLockScreen(
          true,
          { title: `Bhagavad Gita ${chapter}.${verse}`, artist: "Verse recitation", album: `Chapter ${chapter}` },
          { showSeekForward: false, showSeekBackward: false }
        );
      } catch (e) {
        // lock screen controls are best-effort
      }
    },
    [player]
  );

  const statusRef = useRef(status);
  statusRef.current = status;
  const toggle = useCallback(() => {
    if (!current) return;
    const st = statusRef.current;
    if (st.playing) player.pause();
    else {
      if (st.didJustFinish || (st.duration && st.currentTime >= st.duration - 0.05)) player.seekTo(0);
      player.play();
    }
  }, [current, player]);

  const stop = useCallback(() => {
    player.pause();
    try {
      player.clearLockScreenControls();
    } catch (e) {}
    setCurrent(null);
  }, [player]);

  // Finished a verse: repeat, continue, or stop.
  useEffect(() => {
    if (!status.didJustFinish || !current || handledFinish.current) return;
    handledFinish.current = true;
    if (repeatLeft.current > 0) {
      repeatLeft.current -= 1;
      handledFinish.current = false;
      player.seekTo(0).then(() => player.play());
      return;
    }
    const continuous = current.mode === "chapter" || current.mode === "book" || autoPlayNext;
    if (!continuous) return;
    const n = nextVerse(current.chapter, current.verse);
    if (!n) return;
    if (current.mode === "chapter" && n.chapter !== current.chapter) return;
    load(n.chapter, n.verse, current.mode);
  }, [status.didJustFinish, current, autoPlayNext, load, player]);

  // Network/CDN failure: retry once from the fallback host.
  useEffect(() => {
    if (!current || !urls.current) return;
    const failed = status.playbackState === "failed" || status.error;
    if (!failed) return;
    if (!triedFallback.current && urls.current.fallbackUrl && urls.current.fallbackUrl !== urls.current.url) {
      triedFallback.current = true;
      player.replace({ uri: urls.current.fallbackUrl });
      player.play();
    } else {
      setError("Couldn't load the recitation. Check your internet connection.");
    }
  }, [status.playbackState, status.error, current, player]);

  const value = useMemo(
    () => ({
      current,
      playing: !!status.playing,
      buffering: !!status.isBuffering && !status.playing,
      error,
      play: load,
      toggle,
      stop,
      setRepeat: (n) => {
        repeatTotal.current = Math.max(1, n);
      },
      isCurrent: (c, v) => !!current && current.chapter === c && current.verse === v,
    }),
    [current, status.playing, status.isBuffering, error, load, toggle, stop]
  );
  const progress = useMemo(
    () => ({ currentTime: status.currentTime || 0, duration: status.duration || 0 }),
    [status.currentTime, status.duration]
  );

  return (
    <AudioContext.Provider value={value}>
      <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
    </AudioContext.Provider>
  );
}

export function useRecitation() {
  return useContext(AudioContext);
}

/** {currentTime, duration} of the current recitation; re-renders 4×/second while playing. */
export function useRecitationProgress() {
  return useContext(ProgressContext);
}
