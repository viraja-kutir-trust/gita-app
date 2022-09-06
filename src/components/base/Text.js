import { Text as NativeText, StyleSheet } from "react-native";
import { Text as PaperText } from "react-native-paper";

export default function Text({ type, variant, style, ...args }) {
  if (type === "native") {
    return <NativeText style={{ ...textStyle.text, ...style }} {...args} />;
  }

  return (
    <PaperText
      variant={variant}
      style={{ ...textStyle.text, ...style }}
      {...args}
    />
  );
}

const textStyle = StyleSheet.create({
  text: {
    fontFamily: "readex-pro",
  },
});
