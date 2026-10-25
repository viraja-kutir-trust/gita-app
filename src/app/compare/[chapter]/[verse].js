import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Chip, ChipRow, Icon, T } from "../../../ui/components";
import { Blocks } from "../../../ui/reading";
import { fonts, useTheme } from "../../../ui/theme";
import { useTexts, useVerse, useWordMeanings } from "../../../data/gita";
import { authorName, LANGS } from "../../../lib/names";
import { toScript } from "../../../lib/script";
import { orderTranslations, plainText } from "../../../lib/texts";
import { blocksPropsFor } from "../../../lib/translate";
import CardMenu, { TranslationNote } from "../../../ui/CardMenu";
import useCardTranslation from "../../../ui/useCardTranslation";
import { setSetting, toggleHiddenTranslator } from "../../../state/store";

const STOP = new Set(["the", "a", "an", "of", "in", "on", "to", "and", "or", "by", "with", "for", "from", "at", "is", "be", "your", "my", "his", "their", "its", "all", "one", "who", "not", "never", "only", "certainly", "indeed", "o"]);

/** Search terms that find how each translator rendered a Sanskrit word. */
function traceTerms(m, lemmaDev) {
  const en = (m.meaning || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, w.length - 2) : w.replace(/s$/, "")));
  const dev = lemmaDev ? [lemmaDev.replace(/्$/, "")] : [];
  const te = lemmaDev ? [toScript(lemmaDev.replace(/्$/, ""), "te")] : [];
  return [...new Set([...en, ...dev, ...te])].filter((t) => t.length >= 2);
}

export default function Compare() {
  const params = useLocalSearchParams();
  const chapter = Number(params.chapter);
  const v = Number(params.verse);
  const dispatch = useDispatch();
  const { c } = useTheme();
  const s = useSelector((st) => st.settings);
  const { data: verse } = useVerse(chapter, v);
  const { data: texts } = useTexts(verse?.id, "translation");
  const { data: words } = useWordMeanings(verse);
  const [lang, setLang] = useState("all");
  const [trace, setTrace] = useState(null);
  const [manage, setManage] = useState(false);
  const [folded, setFolded] = useState({});

  const shown = useMemo(() => {
    const all = manage ? (texts || []).slice().sort((a, b) => a.authorId - b.authorId) : orderTranslations(texts, { primaryId: s.primaryTranslatorId, order: s.translatorOrder, hidden: s.hiddenTranslators });
    return lang === "all" ? all : all.filter((t) => t.lang === lang);
  }, [texts, s.primaryTranslatorId, s.translatorOrder, s.hiddenTranslators, lang, manage]);

  const langCounts = useMemo(() => {
    const m = {};
    for (const t of texts || []) m[t.lang] = (m[t.lang] || 0) + 1;
    return m;
  }, [texts]);

  // Candidate words to trace: content words of the verse (nouns, verbs, adjectives).
  const traceable = useMemo(() => {
    if (!words) return [];
    return words.meanings
      .map((m, i) => {
        const w = words.words.find((x) => m.dcsIdx?.includes(x.idx));
        return { i, m, w };
      })
      .filter(({ w }) => w && ["noun", "verb", "adjective"].includes(w.pos))
      .slice(0, 6);
  }, [words]);
  const headerOptions = useMemo(
    () => ({
          headerTitle: () => (
            <View style={{ alignItems: "center" }}>
              <T v="headline">Translations</T>
              <T v="caption" muted>
                {chapter}.{v} · {texts?.length || 0} available
              </T>
            </View>
          ),
          headerRight: () => (
            <Pressable onPress={() => setManage((m) => !m)} hitSlop={10} accessibilityRole="button">
              <T v="calloutStrong" accent>
                {manage ? "Done" : "Edit"}
              </T>
            </Pressable>
          ),
        }),
    [chapter, v, texts?.length, manage]
  );
  const terms = trace != null ? traceTerms(traceable[trace].m, traceable[trace].w?.lemmaDev) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={headerOptions} />
      <FlatList
        data={shown}
        keyExtractor={(t) => String(t.id)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingVertical: 12 }}>
            <ChipRow>
              <Chip label={`All ${texts?.length || ""}`.trim()} selected={lang === "all"} onPress={() => setLang("all")} />
              {Object.entries(langCounts).map(([l, n]) => (
                <Chip key={l} label={`${LANGS[l]?.native || l} ${n}`} selected={lang === l} onPress={() => setLang(l)} />
              ))}
            </ChipRow>
            {manage ? (
              <T v="footnote" muted style={{ paddingHorizontal: 20 }}>
                Choose which translation shows first on every verse, and hide the ones you don't read.
              </T>
            ) : traceable.length ? (
              <View style={[styles.trace, { backgroundColor: c.accentSoft }]}>
                <T v="footnote" color={c.ink2} style={{ paddingHorizontal: 14 }}>
                  Trace a word across translations
                </T>
                <ChipRow contentStyle={{ paddingHorizontal: 14 }}>
                  {traceable.map((t, k) => (
                    <Chip
                      key={k}
                      small
                      label={toScript(t.m.termDev, s.script === "ro" ? "dv" : s.script) || t.m.termIast}
                      selected={trace === k}
                      onPress={() => setTrace(trace === k ? null : k)}
                      accessibilityLabel={`Trace ${t.m.termIast}, ${t.m.meaning}`}
                    />
                  ))}
                </ChipRow>
                {trace != null ? (
                  <T v="caption" muted style={{ paddingHorizontal: 14 }}>
                    <T style={{ fontFamily: fonts.sanskritItalic, fontSize: 12 }}>{traceable[trace].m.termIast}</T> — {traceable[trace].m.meaning}
                  </T>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: t }) => (
          <CompareCard
            t={t}
            chapter={chapter}
            v={v}
            manage={manage}
            folded={!!folded[t.id]}
            onFold={() => setFolded((f) => ({ ...f, [t.id]: !f[t.id] }))}
            terms={terms}
          />
        )}
      />
    </View>
  );
}

/** One translator's rendering, with its ⋯ menu (translate, copy, share, make default). */
function CompareCard({ t, chapter, v, manage, folded, onFold, terms }) {
  const dispatch = useDispatch();
  const { c } = useTheme();
  const s = useSelector((st) => st.settings);
  const tx = useCardTranslation({ key: t.id, lang: t.lang, source: t.blocks });
  const hidden = s.hiddenTranslators.includes(t.authorId);
  const primary = s.primaryTranslatorId === t.authorId;
  const name = authorName(t.authorId, t.authorName);
  return (
    <View style={[styles.card, { backgroundColor: c.surface, opacity: manage && hidden ? 0.5 : 1 }]}>
      <View style={styles.between}>
        <Pressable onPress={onFold} accessibilityRole="button" accessibilityState={{ expanded: !folded }} style={[styles.between, { flex: 1 }]}>
          <Icon name={folded ? "chevronRight" : "chevronDown"} size={12} color={c.muted} />
          <T v="footnoteStrong" muted numberOfLines={1} style={{ flexShrink: 1, flex: 1 }}>
            {name} · {LANGS[t.lang]?.label || t.lang}
            {t.license && /public/i.test(t.license) ? " · public domain" : ""}
          </T>
          {primary && !manage ? (
            <T v="caption" accent>
              Shown first
            </T>
          ) : null}
        </Pressable>
        {!manage ? (
          <View style={{ marginVertical: -6, marginRight: -6 }}>
            <CardMenu
              title={`${name} · ${LANGS[t.lang]?.label || t.lang}`}
              tx={tx}
              text={() => plainText(tx.value)}
              cite={`— ${name}, Bhagavad Gita ${chapter}.${v}`}
              extra={primary ? [] : [{ label: "Make default translation", icon: "star", onPress: () => dispatch(setSetting({ primaryTranslatorId: t.authorId })) }]}
            />
          </View>
        ) : null}
      </View>
      {(!manage || !hidden) && !folded ? (
        tx.to ? (
          <Blocks blocks={tx.value} {...blocksPropsFor(tx.to)} size={16 * s.fontScale} />
        ) : (
          <Blocks blocks={t.blocks} lang={t.lang} size={16 * s.fontScale} terms={terms} teluguScript={s.teluguScript === "follow" ? s.script : "te"} />
        )
      ) : null}
      {!folded ? <TranslationNote tx={tx} /> : null}
      {manage ? (
        <View style={styles.manage}>
          <Pressable onPress={() => dispatch(setSetting({ primaryTranslatorId: t.authorId }))} style={styles.manageBtn} accessibilityRole="button">
            <Icon name={primary ? "checkCircle" : "check"} size={16} color={primary ? c.accent : c.muted} />
            <T v="footnoteStrong" color={primary ? c.accent : c.ink2}>
              {primary ? "Shown first" : "Show first"}
            </T>
          </Pressable>
          {!primary ? (
            <Pressable onPress={() => dispatch(toggleHiddenTranslator(t.authorId))} style={styles.manageBtn} accessibilityRole="button">
              <T v="footnoteStrong" color={c.ink2}>
                {hidden ? "Show in list" : "Hide"}
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trace: { marginHorizontal: 16, borderRadius: 16, paddingVertical: 12, gap: 8 },
  card: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, padding: 16, gap: 8 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  manage: { flexDirection: "row", gap: 18, paddingTop: 4 },
  manageBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
});
