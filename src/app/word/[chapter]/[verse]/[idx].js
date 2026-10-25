import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { Card, Icon, IconButton, T } from "../../../../ui/components";
import { fonts, useTheme } from "../../../../ui/theme";
import { useVerse, useWordMeanings } from "../../../../data/gita";
import { fromTelugu, scriptFont, toScript } from "../../../../lib/script";
import { teluguFont } from "../../../../ui/study";
import { wordSourceInfo } from "../../../../lib/wordMeanings";
import { blocksPropsFor } from "../../../../lib/translate";
import CardMenu, { TranslationNote } from "../../../../ui/CardMenu";
import useCardTranslation from "../../../../ui/useCardTranslation";

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

// The traditional Sanskrit name for each grammatical term (Devanagari; shown in the reader's script).
// Terms with no settled traditional equivalent (e.g. "indicative", "past") are left without one.
const SANSKRIT_TERM = {
  noun: "नाम",
  verb: "क्रियापदम्",
  adjective: "विशेषणम्",
  pronoun: "सर्वनाम",
  adverb: "क्रियाविशेषणम्",
  particle: "निपातः",
  conjunction: "अव्ययम्",
  "subordinating conjunction": "अव्ययम्",
  interjection: "निपातः",
  adposition: "कर्मप्रवचनीयः",
  numeral: "सङ्ख्या",
  nominative: "प्रथमा विभक्तिः",
  accusative: "द्वितीया विभक्तिः",
  instrumental: "तृतीया विभक्तिः",
  dative: "चतुर्थी विभक्तिः",
  ablative: "पञ्चमी विभक्तिः",
  genitive: "षष्ठी विभक्तिः",
  locative: "सप्तमी विभक्तिः",
  vocative: "सम्बोधनम्",
  singular: "एकवचनम्",
  dual: "द्विवचनम्",
  plural: "बहुवचनम्",
  masculine: "पुंलिङ्गम्",
  feminine: "स्त्रीलिङ्गम्",
  neuter: "नपुंसकलिङ्गम्",
  "3rd person": "प्रथमपुरुषः",
  "2nd person": "मध्यमपुरुषः",
  "1st person": "उत्तमपुरुषः",
  present: "लट्",
  imperfect: "लङ्",
  future: "लृट्",
  "s-aorist": "लुङ्",
  imperative: "लोट्",
  optative: "विधिलिङ्",
  conditional: "लृङ्",
  passive: "कर्मणि प्रयोगः",
  participle: "कृदन्तम्",
  "absolutive (gerund)": "क्त्वान्तम् / ल्यबन्तम्",
  infinitive: "तुमुन्नन्तम्",
  gerundive: "कृत्यप्रत्ययान्तम्",
  "compound member": "समासपदम्",
};

function describe(morph) {
  if (!morph) return [];
  const parts = morph.split(" · ");
  const out = [];
  const cap = (p) => p.charAt(0).toUpperCase() + p.slice(1);
  const fact = (k, v, p) => out.push({ k, v, sa: SANSKRIT_TERM[p] });
  const pos = parts.shift();
  if (pos) fact("Part of speech", cap(pos), pos);
  for (const p of parts) {
    if (CASE_HINT[p]) fact("Case", `${cap(p)} · ${CASE_HINT[p]}`, p);
    else if (["singular", "dual", "plural"].includes(p)) fact("Number", cap(p), p);
    else if (["masculine", "feminine", "neuter"].includes(p)) fact("Gender", cap(p), p);
    else if (/person/.test(p)) fact("Person", p, p);
    else if (/present|past|future|perfect|aorist|imperfect/.test(p)) fact("Tense", p, p);
    else if (/imperative|optative|injunctive|indicative|conditional/.test(p)) fact("Mood", p, p);
    else fact("Form", p, p);
  }
  return out;
}

/** Several word-by-word entries shown as one: terms side by side, meanings in order, all their grammar. */
function combineEntries(list) {
  const join = (f, sep) => list.map((e) => e[f]).filter(Boolean).join(sep);
  return {
    termDev: join("termDev", " "),
    termTe: join("termTe", " "),
    termIast: join("termIast", " "),
    meaning: join("meaning", "; "),
    dcsIdx: list.flatMap((e) => e.dcsIdx || []),
  };
}

export default function WordSheet() {
  const params = useLocalSearchParams();
  const chapter = Number(params.chapter);
  const v = Number(params.verse);
  const router = useRouter();
  const { c } = useTheme();
  const script = useSelector((s) => s.settings.script);
  const teluguScript = useSelector((s) => (s.settings.teluguScript === "follow" ? s.settings.script : "te"));
  const { data: verse } = useVerse(chapter, v);
  const { data: words } = useWordMeanings(verse);
  const [i, setI] = useState(Number(params.idx) || 0);
  // Entries opened together with `idx` (a padaccheda word the list glosses in parts).
  const [also, setAlso] = useState(() => String(params.with || "").split(",").filter(Boolean).map(Number));
  const tx = useCardTranslation({ key: verse && words ? `${verse.id}:${words.source}` : null, lang: words?.lang || "english", source: words?.meanings, kind: "meanings" });
  const meanings = tx.value || [];
  const ids = [...new Set([Math.min(i, meanings.length - 1), ...also])].filter((k) => k >= 0 && k < meanings.length).sort((a, b) => a - b);
  const m = ids.length > 1 ? combineEntries(ids.map((k) => meanings[k])) : meanings[Math.min(i, meanings.length - 1)];
  const step = (d) => {
    const from = d < 0 ? ids[0] : ids[ids.length - 1];
    setAlso([]);
    setI(Math.max(0, Math.min(meanings.length - 1, (from ?? i) + d)));
  };
  const first = ids[0] ?? i;
  const last = ids[ids.length - 1] ?? i;
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
        <IconButton name="chevronLeft" label="Previous word" onPress={() => step(-1)} style={{ opacity: first > 0 ? 1 : 0.3 }} />
        <View style={{ alignItems: "center", flex: 1 }}>
          {shown ? (
            <T style={{ fontFamily: scriptFont(script), fontSize: 30, lineHeight: 44, color: c.ink }} accessibilityLanguage="sa">
              {shown}
            </T>
          ) : null}
          <T style={{ fontFamily: fonts.sanskritItalic, fontSize: shown ? 17 : 28, color: shown ? c.muted : c.ink }}>{m.termIast}</T>
        </View>
        <IconButton name="chevronRight" label="Next word" onPress={() => step(1)} style={{ opacity: last < meanings.length - 1 ? 1 : 0.3 }} />
      </View>
      <View style={styles.countRow}>
        <View style={{ width: 32 }} />
        <T v="caption" muted style={{ textAlign: "center", flex: 1 }}>
          {ids.length > 1 ? `Words ${ids.map((k) => k + 1).join(" + ")} of ${meanings.length}` : `Word ${first + 1} of ${meanings.length}`} in {chapter}.{v}
        </T>
        <CardMenu
          title={`${m.termIast} · ${wordSourceInfo(words.source).name}`}
          tx={tx}
          text={() => `${m.termIast} — ${m.meaning}`}
          cite={`— ${wordSourceInfo(words.source).name}, Bhagavad Gita ${chapter}.${v}`}
        />
      </View>

      {tx.to ? (
        <T v="title3" style={{ textAlign: "center", marginTop: 6, ...(blocksPropsFor(tx.to).font ? { fontFamily: blocksPropsFor(tx.to).font } : null) }}>
          {m.meaning.replace(/⁽\d+⁾/g, "")}
        </T>
      ) : words.lang === "telugu" ? (
        // Swami Nirvikalpananda's Telugu meaning (footnote numbers are on the verse page)
        <T style={{ fontFamily: teluguFont(teluguScript), fontSize: 21, lineHeight: 34, color: c.ink, textAlign: "center", marginTop: 6 }}>
          {fromTelugu(m.meaning.replace(/⁽\d+⁾/g, ""), teluguScript)}
        </T>
      ) : (
        <T v="title3" style={{ textAlign: "center", marginTop: 6 }}>
          {m.meaning}
        </T>
      )}
      <TranslationNote tx={tx} style={{ alignSelf: "center" }} />

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
                {f.sa ? (
                  <T style={{ fontFamily: scriptFont(script), fontSize: 15, lineHeight: 24, color: c.accent }} accessibilityLanguage="sa">
                    {toScript(f.sa, script)}
                  </T>
                ) : null}
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
  countRow: { flexDirection: "row", alignItems: "center" },
  wrap: { padding: 20, paddingTop: 28, gap: 14 },
  nav: { flexDirection: "row", alignItems: "center", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fact: { flexGrow: 1, flexBasis: "45%", padding: 12, borderRadius: 14, gap: 2 },
  more: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, marginTop: 4 },
});
