import { forwardRef } from "react";
import { Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./theme";

/** Scroll container for tab screens: works with native large titles and leaves room for the tab bar. */
const Screen = forwardRef(function Screen({ children, style, contentStyle, bottom = 32, ...rest }, ref) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      ref={ref}
      contentInsetAdjustmentBehavior="automatic"
      style={[{ flex: 1, backgroundColor: c.bg }, style]}
      contentContainerStyle={[{ paddingBottom: bottom + (Platform.OS === "android" ? 0 : insets.bottom) }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...rest}
    >
      {children}
    </ScrollView>
  );
});

export default Screen;
