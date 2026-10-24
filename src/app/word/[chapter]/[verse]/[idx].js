import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { Card, Icon, IconButton, T } from "../../../../ui/components";
import { fonts, useTheme } from "../../../../ui/theme";
import { useVerse, useWordMeanings } from "../../../../data/gita";
import { scriptFont, toScript } from "../../../../lib/script";
import { wordSourceInfo } from "../../../../lib/wordMeanings";

// "noun · locative · plural · neuter" → labelled facts a learner can read.
const CASE_HINT = {
  nominative: "subject",
  accusative: "object · “to”",
  instrumental: "“by, with”",
  dative: "“for”",
  ablative: "“from”",
  genitive: "“of”",
  locative: "“in, on”",
  vocative: "addressing",
};

function describe(morph) {
  if (!morph) return [];
  const parts = morph.split(" · ");
  const out = [];
  const pos = parts.shift();
  if (pos) out.push({ k: "Part of speech", v: pos.charAt(0).toUpperCase() + pos.slice(1) });
  for (const p of parts) {
    if (CASE_HINT[p]) out.push({ k: "Case", v: `${p.charAt(0).toUpperCase() + p.slice(1)} · ${CASE_HINT[p]}` });
    else if (["singular", "dual", "plural"].includes(p)) out.push({ k: "Number", v: p.charAt(0).toUpperCase() + p.slice(1) });
    else if (["masculine", "feminine", "neuter"].includes(p)) out.push({ k: "Gender", v: p.charAt(0).toUpperCase() + p.slice(1) });
    else if (/person/.test(p)) out.push({ k: "Person", v: p });
    else if (/present|past|future|perfect|aorist|imperfect/.test(p)) out.push({ k: "Tense", v: p });
    else if (/imperative|optative|injunctive|indicative|conditional/.test(p)) out.push({ k: "Mood", v: p });
    else out.push({ k: "Form", v: p });
  }
  return out;
}

export default function WordSheet() {
  const params = useLocalSearchParams();
  const chapter = Number(params.chapter);
  const v = Number(params.verse);
  const router = useRouter();
  const { c } = useTheme();
  const script = useSelector((s) => s.settings.script);
  const { data: verse } = useVerse(chapter, v);
  const { data: words } = useWordMeanings(verse);
  const [i, setI] = useState(Number(params.idx) || 0);
  const meanings = words?.meanings || [];
  const m = meanings[Math.min(i, meanings.length - 1)];
  const grammar = useMemo(() => {
    if (!m || !words) return [];
    return (m.dcsIdx || []).map((di) => words.words.find((w) => w.idx === di)).filter(Boolean);
  }, [m, words]);
  if (!m) return <View style={{ flex: 1, backgroundColor: c.surface }} />;
  const devTerm = m.termDev || "";
  const shown = script === "ro" ? null : toScript(devTerm, script);

  return (
    <ScrollView style={{ backgroundColor: c.surface }} contentContainerStyle={styles.wrap}>
      <View style={styles.nav}>
        <IconButton name="chevronLeft" label="Previous word" onPress={() => setI((x) => Math.max(0, x - 1))} style={{ opacity: i > 0 ? 1 : 0.3 }} />
        <View style={{ alignItems: "center", flex: 1 }}>
          {shown ? (
            <T style={{ fontFamily: scriptFont(script), fontSize: 30, lineHeight: 44, color: c.ink }} accessibilityLanguage="sa">
              {shown}
            </T>
          ) : null}
          <T style={{ fontFamily: fonts.sanskritItalic, fontSize: shown ? 17 : 28, color: shown ? c.muted : c.ink }}>{m.termIast}</T>
        </View>
        <IconButton name="chevronRight" label="Next word" onPress={() => setI((x) => Math.min(meanings.length - 1, x + 1))} style={{ opacity: i < meanings.length - 1 ? 1 : 0.3 }} />
      </View>
      <T v="caption" muted style={{ textAlign: "center" }}>
        Word {i + 1} of {meanings.length} in {chapter}.{v}
      </T>

      <T v="title3" style={{ textAlign: "center", marginTop: 6 }}>
        {m.meaning}
      </T>

      {grammar.map((w) => (
        <View key={w.idx} style={{ gap: 8 }}>
          {grammar.length > 1 ? (
            <T v="footnoteStrong" muted>
              {w.unsandhied || w.form}
            </T>
          ) : null}
          <View style={styles.grid}>
            <Card tone="muted" style={styles.fact}>
              <T v="caption" muted>
                Root word
              </T>
              <T v="subheadStrong" numberOfLines={1}>
                <T style={{ fontFamily: scriptFont(script === "ro" ? "dv" : script), fontSize: 15 }}>{script === "ro" ? "" : toScript(w.lemmaDev || "", script) + "  "}</T>
                {w.lemma}
              </T>
            </Card>
            {describe(w.morph).map((f, k) => (
              <Card key={k} tone="muted" style={styles.fact}>
                <T v="caption" muted>
                  {f.k}
                </T>
                <T v="subheadStrong" numberOfLines={2}>
                  {f.v}
                </T>
              </Card>
            ))}
          </View>
        </View>
      ))}

      {grammar[0]?.lemma ? (
        <Card
          tone="accent"
          style={styles.more}
          onPress={() => {
            router.back();
            router.navigate({ pathname: "/search", params: { q: grammar[0].lemma } });
          }}
          accessibilityLabel={`Find other verses with ${grammar[0].lemma}`}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <T v="calloutStrong">Other verses with “{grammar[0].lemma}”</T>
            <T v="footnote" muted>
              See how the Gita uses this word elsewhere
            </T>
          </View>
          <Icon name="chevronRight" size={15} color={c.accent} />
        </Card>
      ) : null}
      <T v="caption" muted style={{ textAlign: "center", marginTop: 4 }}>
        Meaning: {words ? wordSourceInfo(words.source).name : ""} · Grammar: Digital Corpus of Sanskrit (O. Hellwig), CC BY 4.0
      </T>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 28, gap: 14 },
  nav: { flexDirection: "row", alignItems: "center", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fact: { flexGrow: 1, flexBasis: "45%", padding: 12, borderRadius: 14, gap: 2 },
  more: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, marginTop: 4 },
});
