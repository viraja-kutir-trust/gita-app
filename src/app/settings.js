import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Card, Icon, IconButton, ListRow, ProgressBar, T, tap } from "../ui/components";
import { availableWordSources, DEFAULT_WORD_SOURCE } from "../lib/wordMeanings";
import { AUDIO_ENABLED } from "../lib/features";
import { Sloka } from "../ui/reading";
import { useTheme } from "../ui/theme";
import { useVerse } from "../data/gita";
import { SCRIPTS } from "../lib/script";
import { setSetting } from "../state/store";
import { deleteModel, downloadedModels, targetByCode, translationAvailable } from "../lib/translate";

const THEMES = [
  { key: "auto", label: "Auto" },
  { key: "light", label: "Light" },
  { key: "sepia", label: "Sepia" },
  { key: "dark", label: "Dark" },
];

export default function Settings() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { c } = useTheme();
  const s = useSelector((st) => st.settings);
  const { data: sample } = useVerse(2, 47);
  const set = (patch) => {
    tap();
    dispatch(setSetting(patch));
  };
  const sizePct = (s.fontScale - 0.8) / 0.7;

  return (
    <ScrollView style={{ backgroundColor: c.surface }} contentContainerStyle={styles.wrap}>
      <View style={styles.head}>
        <T v="title">Reading</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <T v="calloutStrong" accent>
            Done
          </T>
        </Pressable>
      </View>

      <Card tone="muted" style={{ alignItems: "center", paddingVertical: 18 }}>
        {sample ? <Sloka verse={sample} script={s.script} size={19 * s.fontScale} showIast={s.showIast} /> : <View style={{ height: 90 }} />}
      </Card>

      <View style={{ gap: 8 }}>
        <T v="footnoteStrong" muted>
          Show Sanskrit in
        </T>
        <View style={styles.grid}>
          {SCRIPTS.map((sc) => {
            const on = s.script === sc.key;
            return (
              <Pressable
                key={sc.key}
                onPress={() => set({ script: sc.key })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={sc.name}
                style={[styles.option, { borderColor: on ? c.accent : c.line, borderWidth: on ? 2 : 1, backgroundColor: on ? c.accentSoft : c.surface }]}
              >
                <T style={{ fontFamily: sc.font, fontSize: 15, lineHeight: 22, color: c.ink }} numberOfLines={1} adjustsFontSizeToFit>
                  {sc.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={styles.between}>
          <T v="footnoteStrong" muted>
            Text size
          </T>
          <T v="footnote" muted>
            {Math.round(s.fontScale * 100)}%
          </T>
        </View>
        <View style={styles.sizeRow}>
          <IconButton name="textSize" label="Smaller text" iconSize={15} style={[styles.sizeBtn, { backgroundColor: c.surface2 }]} onPress={() => set({ fontScale: Math.max(0.8, +(s.fontScale - 0.1).toFixed(2)) })} />
          <ProgressBar value={sizePct} height={4} style={{ flex: 1 }} label="Text size" />
          <IconButton name="textSize" label="Larger text" iconSize={24} style={[styles.sizeBtn, { backgroundColor: c.surface2 }]} onPress={() => set({ fontScale: Math.min(1.5, +(s.fontScale + 0.1).toFixed(2)) })} />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <T v="footnoteStrong" muted>
          Theme
        </T>
        <View style={styles.grid}>
          {THEMES.map((t) => {
            const on = s.theme === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => set({ theme: t.key })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.option, { borderColor: on ? c.accent : c.line, borderWidth: on ? 2 : 1, backgroundColor: on ? c.accentSoft : c.surface }]}
              >
                <T v={on ? "subheadStrong" : "subhead"} numberOfLines={1}>
                  {t.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <T v="footnoteStrong" muted>
          Word-by-word meanings from
        </T>
        <Card tone="muted" style={{ padding: 0, overflow: "hidden" }}>
          {availableWordSources().map((src, i, arr) => {
            const on = (s.wordSource || DEFAULT_WORD_SOURCE) === src.key;
            return (
              <Pressable
                key={src.key}
                onPress={() => set({ wordSource: src.key })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.toggle, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}
              >
                <View style={{ flex: 1, gap: 2, paddingVertical: 8 }}>
                  <T v="callout">{src.name}</T>
                  <T v="caption" muted>
                    {src.lineage}
                  </T>
                </View>
                {on ? <Icon name="checkCircle" size={20} color={c.accent} /> : null}
              </Pressable>
            );
          })}
        </Card>
      </View>

      <View style={{ gap: 8 }}>
        <T v="footnoteStrong" muted>
          Telugu meanings (Swami Nirvikalpananda)
        </T>
        <Card tone="muted" style={{ padding: 0, overflow: "hidden" }}>
          {[
            { key: "te", title: "In Telugu script", sub: "తెలుగు లిపిలో, as printed in the book" },
            { key: "follow", title: "In the script chosen above", sub: "Transliterated, e.g. Telugu words in देवनागरी" },
          ].map((o, i) => {
            const on = (s.teluguScript || "te") === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => set({ teluguScript: o.key })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.toggle, i === 0 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}
              >
                <View style={{ flex: 1, gap: 2, paddingVertical: 8 }}>
                  <T v="callout">{o.title}</T>
                  <T v="caption" muted>
                    {o.sub}
                  </T>
                </View>
                {on ? <Icon name="checkCircle" size={20} color={c.accent} /> : null}
              </Pressable>
            );
          })}
        </Card>
      </View>

      <Card tone="muted" style={{ padding: 0, overflow: "hidden" }}>
        <Toggle label="Transliteration under each verse" value={s.showIast} onChange={(x) => set({ showIast: x })} />
        <Toggle label="Padaccheda (words split) under each verse" value={s.showPadaccheda !== false} onChange={(x) => set({ showPadaccheda: x })} />
        {AUDIO_ENABLED ? <Toggle label="Play the next verse automatically" value={s.autoPlayNext} onChange={(x) => set({ autoPlayNext: x })} /> : null}
        <Toggle label="Mark a verse read when I move on" value={s.markReadOnMove} onChange={(x) => set({ markReadOnMove: x })} last />
      </Card>

      {translationAvailable ? <TranslationLanguages /> : null}

      <Card tone="muted" style={{ padding: 0, overflow: "hidden" }}>
        <ListRow
          title="Take the tour again"
          subtitle="A one-minute walk through the app"
          onPress={() => {
            router.back();
            router.push("/welcome");
          }}
        />
        <ListRow
          title="Sources & credits"
          subtitle="Where every text and recording comes from"
          onPress={() => {
            router.back();
            router.push("/about");
          }}
          last
        />
      </Card>
    </ScrollView>
  );
}

/** Languages downloaded for on-device translation (the ⋯ menu on a card), each removable. */
function TranslationLanguages() {
  const { c } = useTheme();
  const [have, setHave] = useState(null);
  useEffect(() => {
    downloadedModels().then(setHave);
  }, []);
  const removable = (have || []).filter((code) => code !== "en");
  const remove = (code) => {
    tap();
    deleteModel(code)
      .catch(() => {})
      .then(() => downloadedModels().then(setHave));
  };
  return (
    <View style={{ gap: 8 }}>
      <T v="footnoteStrong" muted>
        Translation languages
      </T>
      <Card tone="muted" style={{ padding: 0, overflow: "hidden" }}>
        {removable.map((code) => (
          <View key={code} style={[styles.toggle, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}>
            <View style={{ flex: 1, paddingVertical: 8 }}>
              <T v="callout">{targetByCode[code]?.native || code}</T>
              {targetByCode[code] && targetByCode[code].native !== targetByCode[code].name ? (
                <T v="caption" muted>
                  {targetByCode[code].name}
                </T>
              ) : null}
            </View>
            <IconButton name="trash" label={`Remove ${targetByCode[code]?.name || code}`} size={36} iconSize={17} color={c.muted} onPress={() => remove(code)} />
          </View>
        ))}
        <T v="caption" muted style={{ padding: 14 }}>
          {removable.length ? "Kept on this device so translation works offline. " : "None downloaded yet. "}
          Translate a translation, commentary or word meaning from the ⋯ on its card. It's a machine's reading, so some meaning may get lost in translation. Sanskrit is never translated.
        </T>
      </Card>
    </View>
  );
}

function Toggle({ label, value, onChange, last }) {
  const { c } = useTheme();
  return (
    <View style={[styles.toggle, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}>
      <T v="callout" style={{ flex: 1 }}>
        {label}
      </T>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent }} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 24, gap: 18, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { flexBasis: "22%", flexGrow: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  between: { flexDirection: "row", justifyContent: "space-between" },
  sizeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  sizeBtn: { borderRadius: 22 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 52 },
});
