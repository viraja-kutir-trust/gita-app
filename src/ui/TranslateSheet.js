import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { Icon, T, tap } from "./components";
import { useTheme } from "./theme";
import { downloadedModels, missingModels, SOURCE_CODES, targetByCode, TARGETS } from "../lib/translate";
import { langLabel } from "../lib/names";

/** Language picker for translating one card. Calls onPick(code) once any needed download is agreed. */
export default function TranslateSheet({ visible, from, onPick, onClose }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const recent = useSelector((s) => s.settings.translateTo);
  const [have, setHave] = useState([]);
  const fromCode = SOURCE_CODES[from];

  useEffect(() => {
    if (visible) downloadedModels().then(setHave);
  }, [visible]);

  const choose = async (code) => {
    tap();
    const missing = await missingModels(fromCode, code);
    if (!missing.length) {
      onClose();
      onPick(code);
      return;
    }
    const names = missing.map((m) => targetByCode[m]?.name || m).join(" and ");
    Alert.alert(`Download ${names}?`, `A one-time download of about ${30 * missing.length} MB, kept on this device so translation works offline.`, [
      { text: "Not now", style: "cancel" },
      {
        text: "Download",
        onPress: () => {
          onClose();
          onPick(code);
        },
      },
    ]);
  };

  const list = TARGETS.filter((t) => t.code !== fromCode);
  const first = recent && recent !== fromCode && targetByCode[recent] ? [targetByCode[recent], ...list.filter((t) => t.code !== recent)] : list;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 8 }]} onPress={() => {}}>
          <View style={styles.head}>
            <T v="headline">Read in another language</T>
            <T v="footnote" muted>
              From {langLabel(from)}. Translated on your device. Some meaning, and much of the poetry, may get lost in translation.
            </T>
          </View>
          <ScrollView style={{ maxHeight: 420 }}>
            {first.map((t, i) => {
              const ready = t.code === "en" || have.includes(t.code);
              return (
                <Pressable
                  key={t.code}
                  onPress={() => choose(t.code)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.name}${ready ? "" : ", needs a download"}`}
                  style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface2 : "transparent", borderBottomColor: c.line }]}
                >
                  <View style={{ flex: 1 }}>
                    <T v="body">{t.native}</T>
                    {t.native !== t.name ? (
                      <T v="caption" muted>
                        {t.name}
                      </T>
                    ) : null}
                  </View>
                  {i === 0 && t.code === recent ? (
                    <T v="caption" muted>
                      Last used
                    </T>
                  ) : null}
                  {ready ? <Icon name="checkCircle" size={16} color={c.muted} /> : <T v="caption" muted>~30 MB</T>}
                </Pressable>
              );
            })}
          </ScrollView>
          <T v="caption" muted style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            Sanskrit is always kept as it is.
          </T>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18 },
  head: { paddingHorizontal: 20, paddingBottom: 10, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
});
