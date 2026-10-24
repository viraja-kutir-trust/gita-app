import { Pressable, StyleSheet, View } from "react-native";
import { Glass, Icon, T, tap } from "./components";
import { HIGHLIGHT_COLORS, highlightPalette } from "./reading";
import { useTheme } from "./theme";

/**
 * Floating actions for the words the reader selected: highlight in one of four
 * colours (or remove an existing highlight), add to note, copy, share, search.
 */
export default function SelectionBar({ visible, existing, onColor, onRemove, onNote, onCopy, onShare, onSearch, bottom = 80 }) {
  const { c } = useTheme();
  if (!visible) return null;
  const pal = highlightPalette(c);
  const act = (fn) => () => {
    tap();
    fn?.();
  };
  return (
    <Glass interactive style={[styles.bar, { bottom }]}>
      <View style={styles.colors}>
        {HIGHLIGHT_COLORS.map((k) => {
          const on = existing?.color === k;
          return (
            <Pressable
              key={k}
              onPress={act(() => onColor(k))}
              accessibilityRole="button"
              accessibilityLabel={`Highlight ${k}`}
              accessibilityState={{ selected: on }}
              hitSlop={4}
              style={[styles.dot, { backgroundColor: pal[k], borderColor: on ? c.ink : c.line }]}
            />
          );
        })}
        {existing ? (
          <Pressable onPress={act(onRemove)} accessibilityRole="button" accessibilityLabel="Remove highlight" hitSlop={6} style={styles.action}>
            <Icon name="trash" size={18} color={c.ink} />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.sep, { backgroundColor: c.line }]} />
      <Pressable onPress={act(onNote)} accessibilityRole="button" accessibilityLabel="Add to my note" style={styles.action}>
        <Icon name="note" size={18} color={c.ink} />
        <T v="caption" numberOfLines={1}>
          Note
        </T>
      </Pressable>
      <Pressable onPress={act(onCopy)} accessibilityRole="button" accessibilityLabel="Copy" style={styles.action}>
        <Icon name="copy" size={18} color={c.ink} />
        <T v="caption" numberOfLines={1}>
          Copy
        </T>
      </Pressable>
      <Pressable onPress={act(onShare)} accessibilityRole="button" accessibilityLabel="Share" style={styles.action}>
        <Icon name="share" size={18} color={c.ink} />
        <T v="caption" numberOfLines={1}>
          Share
        </T>
      </Pressable>
      {onSearch ? (
        <Pressable onPress={act(onSearch)} accessibilityRole="button" accessibilityLabel="Search the Gita for this" style={styles.action}>
          <Icon name="search" size={18} color={c.ink} />
          <T v="caption" numberOfLines={1}>
            Search
          </T>
        </Pressable>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: 12, right: 12, minHeight: 62, borderRadius: 31, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 4 },
  colors: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 4 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },
  sep: { width: StyleSheet.hairlineWidth, height: 30, marginHorizontal: 4 },
  action: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 2, height: 52 },
});
