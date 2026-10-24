import { Pressable, StyleSheet, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Icon, T, tap } from "./components";
import { useTheme } from "./theme";
import { setSetting } from "../state/store";

/**
 * A titled section whose header collapses/expands it. The collapsed state is
 * remembered per section `id` (e.g. "words"), so a reader who hides word-by-word
 * once keeps it hidden on every verse.
 */
const NONE = {};

export default function Section({ id, title, right, onRightPress, children, style, onLayout }) {
  const { c } = useTheme();
  const dispatch = useDispatch();
  const collapsedMap = useSelector((s) => s.settings.collapsedSections) || NONE;
  const collapsed = !!collapsedMap[id];
  const toggle = () => {
    tap();
    dispatch(setSetting({ collapsedSections: { ...collapsedMap, [id]: !collapsed } }));
  };
  return (
    <View onLayout={onLayout} style={style}>
      <View style={styles.head}>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          accessibilityLabel={`${title}, ${collapsed ? "collapsed" : "expanded"}`}
          hitSlop={{ top: 10, bottom: 10 }}
          style={styles.titleBtn}
        >
          <Icon name={collapsed ? "chevronRight" : "chevronDown"} size={12} color={c.muted} />
          <T v="footnoteStrong" muted numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </T>
        </Pressable>
        {right ? (
          onRightPress ? (
            <Pressable onPress={onRightPress} hitSlop={10} accessibilityRole="button" style={styles.right}>
              {typeof right === "string" ? (
                <T v="footnoteStrong" accent numberOfLines={1}>
                  {right}
                </T>
              ) : (
                right
              )}
            </Pressable>
          ) : (
            <View style={styles.right}>
              {typeof right === "string" ? (
                <T v="caption" muted numberOfLines={1}>
                  {right}
                </T>
              ) : (
                right
              )}
            </View>
          )
        ) : null}
      </View>
      {collapsed ? null : <View style={{ gap: 8 }}>{children}</View>}
    </View>
  );
}

/** Expand a section programmatically (e.g. when a jump chip targets it). */
export function expandSection(dispatch, collapsedMap, id) {
  if (collapsedMap?.[id]) dispatch(setSetting({ collapsedSections: { ...collapsedMap, [id]: false } }));
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 32 },
  titleBtn: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, paddingVertical: 4 },
  right: { flexShrink: 0, maxWidth: "55%", alignItems: "flex-end" },
});
