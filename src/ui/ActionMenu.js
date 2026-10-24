import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, T, tap } from "./components";
import { useTheme } from "./theme";

/** Bottom action menu (long-press on a paragraph). items: [{label, icon, onPress, destructive}] */
export default function ActionMenu({ visible, title, items, onClose }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Close menu">
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 10 }]}>
          {title ? (
            <T v="footnote" muted numberOfLines={2} style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              {title}
            </T>
          ) : null}
          {items.map((it) => (
            <Pressable
              key={it.label}
              onPress={() => {
                tap();
                onClose();
                setTimeout(it.onPress, 50);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.item, { backgroundColor: pressed ? c.surface2 : "transparent" }]}
            >
              <Icon name={it.icon} size={20} color={it.destructive ? "#C0392B" : c.ink} />
              <T v="body" color={it.destructive ? "#C0392B" : c.ink}>
                {it.label}
              </T>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
  item: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, height: 52 },
});
