import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { canTranslate, SOURCE_CODES, translateBlocks, translateMeanings } from "../lib/translate";
import { setSetting } from "../state/store";

/**
 * On-device translation state for one card. `source` is the card's blocks
 * (kind "blocks") or word meanings (kind "meanings"); `value` is what to render.
 * Translations live only in memory, and reset when the card's text changes.
 */
export default function useCardTranslation({ key, lang, source, kind = "blocks" }) {
  const dispatch = useDispatch();
  const [state, setState] = useState({ to: null, value: null, busy: null, error: null });
  const live = useRef(key);

  useEffect(() => {
    live.current = key;
    setState({ to: null, value: null, busy: null, error: null });
  }, [key]);

  const translate = useCallback(
    (to) => {
      const from = SOURCE_CODES[lang];
      if (!from || !source || to === from) return;
      const forKey = key;
      dispatch(setSetting({ translateTo: to }));
      setState((s) => ({ ...s, busy: to, error: null }));
      const run = kind === "meanings" ? translateMeanings : translateBlocks;
      run(source, from, to, { key })
        .then((value) => {
          if (live.current === forKey) setState({ to, value, busy: null, error: null });
        })
        .catch((e) => {
          if (live.current !== forKey) return;
          const offline = /network|internet|offline|download/i.test(String(e?.message || e));
          setState((s) => ({ ...s, busy: null, error: offline ? "Couldn't download the language. Connect to the internet once and try again." : "Couldn't translate this right now." }));
        });
    },
    [key, lang, source, kind, dispatch]
  );

  const showOriginal = useCallback(() => setState({ to: null, value: null, busy: null, error: null }), []);

  return {
    can: canTranslate(lang),
    from: lang,
    to: state.to,
    busy: state.busy,
    error: state.error,
    value: state.to ? state.value : source,
    translate,
    showOriginal,
  };
}
