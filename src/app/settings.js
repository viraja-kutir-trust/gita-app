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

      <Card tone="muted" style={{ padding: 0, overflow: "hidden" }}>
        <Toggle label="Transliteration under each verse" value={s.showIast} onChange={(x) => set({ showIast: x })} />
        {AUDIO_ENABLED ? <Toggle label="Play the next verse automatically" value={s.autoPlayNext} onChange={(x) => set({ autoPlayNext: x })} /> : null}
        <Toggle label="Mark a verse read when I move on" value={s.markReadOnMove} onChange={(x) => set({ markReadOnMove: x })} last />
      </Card>

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
