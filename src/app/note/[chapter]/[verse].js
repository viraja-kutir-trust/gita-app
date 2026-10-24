import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { T } from "../../../ui/components";
import { fonts, useTheme } from "../../../ui/theme";
import { setNote } from "../../../state/store";

export default function NoteEditor() {
  const { chapter, verse } = useLocalSearchParams();
  const key = `${chapter}.${verse}`;
  const router = useRouter();
  const dispatch = useDispatch();
  const { c } = useTheme();
  const existing = useSelector((s) => s.library.notes[key]);
  const [text, setText] = useState(existing?.text || "");

  const save = () => {
    dispatch(setNote({ key, text }));
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <T v="callout" muted>
            Cancel
          </T>
        </Pressable>
        <T v="headline">Note on {key}</T>
        <Pressable onPress={save} hitSlop={10} accessibilityRole="button">
          <T v="calloutStrong" accent>
            Save
          </T>
        </Pressable>
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="What does this verse mean to you?"
        placeholderTextColor={c.muted}
        multiline
        autoFocus
        textAlignVertical="top"
        accessibilityLabel={`Note on verse ${key}`}
        style={[styles.input, { color: c.ink, backgroundColor: c.surface2 }]}
      />
      {existing ? (
        <Pressable
          onPress={() => {
            dispatch(setNote({ key, text: "" }));
            router.back();
          }}
          accessibilityRole="button"
          style={styles.del}
        >
          <T v="callout" color="#C0392B">
            Delete note
          </T>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12 },
  input: { flex: 1, marginHorizontal: 16, borderRadius: 16, padding: 16, fontFamily: fonts.serif, fontSize: 17, lineHeight: 26, minHeight: 160 },
  del: { alignSelf: "center", padding: 16 },
});
