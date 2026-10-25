import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, T, tap } from "./components";
import { useTheme } from "./theme";

/**
 * Bottom sheet showing one footnote at a glance. Tap outside, swipe the backdrop
 * or press close to dismiss; arrows step through the other notes of the passage.
 * notes: [{n, text}], index: position in notes (null = closed).
 */
export default function FootnoteSheet({ notes, index, onIndex, onClose, fontFamily, size = 17, render = (t) => t, title = "Footnote" }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const visible = index != null && !!notes?.[index];
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;
  const note = notes[index];
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [Math.min(400, height * 0.5), 0] });
  const go = (d) => {
    tap();
    onIndex((index + d + notes.length) % notes.length);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close footnote" />
        <Animated.View
          style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 14, maxHeight: height * 0.6, transform: [{ translateY }] }]}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <View style={styles.head}>
            <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
              <T v="calloutStrong" color={c.accent}>
                {note.n}
              </T>
            </View>
            <T v="headline" style={{ flex: 1 }} numberOfLines={1}>
              {title}
              {notes.length > 1 ? (
                <T v="footnote" muted>
                  {`  ${index + 1} of ${notes.length}`}
                </T>
              ) : null}
            </T>
            {notes.length > 1 ? (
              <>
                <IconButton name="chevronLeft" label="Previous footnote" size={36} iconSize={17} onPress={() => go(-1)} />
                <IconButton name="chevronRight" label="Next footnote" size={36} iconSize={17} onPress={() => go(1)} />
              </>
            ) : null}
            <IconButton name="close" label="Close footnote" size={36} iconSize={17} onPress={onClose} />
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 6 }}>
            <T selectable style={{ fontFamily, fontSize: size, lineHeight: Math.round(size * 1.7), color: c.ink }}>
              {render(note.text)}
            </T>
            {note.unanchored ? (
              <T v="caption" muted style={{ marginTop: 10 }}>
                Printed on this page of the book without a marker in the text.
              </T>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, marginBottom: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 20, paddingRight: 10, paddingBottom: 10 },
  badge: { minWidth: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
});
