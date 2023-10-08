import { Text as NativeText, StyleSheet } from "react-native";
import { Text as PaperText } from "react-native-paper";
import { useSelector } from "react-redux";
import { selectFontSize } from "../../redux/slices/app";
import { capitalizeFirstLetter } from "../../utils";

export default function Text({
  type,
  variant,
  style,
  controlledFontSize,
  ...args
}) {
  const fontSize = useSelector(selectFontSize);
  if (type === "native") {
    return <NativeText style={{ ...textStyle.text, ...style }} {...args} />;
  }

  return (
    <PaperText
      variant={
        controlledFontSize && variant.includes("body")
          ? `body${capitalizeFirstLetter(fontSize)}`
          : "bodyMedium"
      }
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
