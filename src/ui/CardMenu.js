import { useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import ActionMenu from "./ActionMenu";
import TranslateSheet from "./TranslateSheet";
import { IconButton, T, thud } from "./components";
import { useTheme } from "./theme";
import { langLabel } from "../lib/names";
import { targetByCode } from "../lib/translate";

/**
 * The ⋯ in a card's top-right corner: Translate, Copy, Share and card-specific
 * actions (`extra`: [{label, icon, onPress}]). `tx` comes from useCardTranslation;
 * `text()` returns what to copy or share (already translated when the card is).
 */
export default function CardMenu({ title, tx, text, cite, extra = [], size = 32 }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const message = () => {
    const note = tx?.to ? ` (machine-translated from ${langLabel(tx.from)})` : "";
    return `${text().trim()}\n\n${cite || ""}${note}`.trim();
  };
  const items = [
    ...(tx?.can ? [{ label: tx.to ? "Translate to another language" : "Translate", icon: "translate", onPress: () => setTimeout(() => setPicker(true), 300) }] : []),
    ...(tx?.to ? [{ label: "Show original", icon: "undo", onPress: tx.showOriginal }] : []),
    {
      label: "Copy",
      icon: "copy",
      onPress: () => {
        Clipboard.setStringAsync(message());
        thud();
      },
    },
    { label: "Share", icon: "share", onPress: () => Share.share({ message: message() }) },
    ...extra,
  ];
  return (
    <>
      <IconButton name="more" label="More actions" size={size} iconSize={17} color={c.muted} onPress={() => setOpen(true)} />
      <ActionMenu visible={open} title={title} items={items} onClose={() => setOpen(false)} />
      {tx?.can ? <TranslateSheet visible={picker} from={tx.from} onPick={tx.translate} onClose={() => setPicker(false)} /> : null}
    </>
  );
}

/** Under a translated card: the quiet reminder that this is a machine's reading, with the way back. */
export function TranslationNote({ tx, style }) {
  const { c } = useTheme();
  if (!tx || (!tx.to && !tx.busy && !tx.error)) return null;
  if (tx.busy) {
    return (
      <View style={[styles.row, style]}>
        <ActivityIndicator size="small" color={c.muted} />
        <T v="caption" muted>
          Translating to {targetByCode[tx.busy]?.name || tx.busy}…
        </T>
      </View>
    );
  }
  if (tx.error) {
    return (
      <T v="caption" muted style={style}>
        {tx.error}
      </T>
    );
  }
  return (
    <View style={[styles.row, style]}>
      <T v="caption" muted style={{ flexShrink: 1 }}>
        ✦ Machine-translated from {langLabel(tx.from)}. Nuance may be lost.
      </T>
      <Pressable onPress={tx.showOriginal} hitSlop={8} accessibilityRole="button">
        <T v="caption" accent>
          Show original
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
});
