import { forwardRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { fonts, radius, useTheme, UI } from "./theme";

// ---------------------------------------------------------------- icons
// SF Symbols on iOS, Material Symbols on Android/web.
const ICONS = {
  today: ["sun.max", "wb_sunny"],
  chapters: ["book", "menu_book"],
  library: ["bookmark", "bookmarks"],
  search: ["magnifyingglass", "search"],
  back: ["chevron.left", "arrow_back"],
  chevronLeft: ["chevron.left", "chevron_left"],
  chevronRight: ["chevron.right", "chevron_right"],
  chevronDown: ["chevron.down", "expand_more"],
  chevronUp: ["chevron.up", "expand_less"],
  play: ["play.fill", "play_arrow"],
  pause: ["pause.fill", "pause"],
  bookmark: ["bookmark", "bookmark_border"],
  bookmarkFill: ["bookmark.fill", "bookmark"],
  note: ["square.and.pencil", "edit_note"],
  settings: ["slider.horizontal.3", "tune"],
  chant: ["waveform", "graphic_eq"],
  close: ["xmark", "close"],
  check: ["checkmark", "check"],
  checkCircle: ["checkmark.circle.fill", "check_circle"],
  pin: ["pin", "push_pin"],
  pinFill: ["pin.fill", "push_pin"],
  share: ["square.and.arrow.up", "share"],
  more: ["ellipsis", "more_horiz"],
  copy: ["doc.on.doc", "content_copy"],
  repeat: ["repeat", "repeat"],
  info: ["info.circle", "info"],
  trash: ["trash", "delete"],
  history: ["clock", "history"],
  textSize: ["textformat.size", "text_fields"],
  speaker: ["speaker.wave.2", "volume_up"],
  highlight: ["highlighter", "ink_highlighter"],
  list: ["list.bullet", "list"],
};

export function Icon({ name, size = 22, color, weight = "medium", style }) {
  const { c } = useTheme();
  const [ios, android] = ICONS[name] || ICONS.info;
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={size}
      tintColor={color || c.ink}
      weight={Platform.OS === "ios" ? weight : undefined}
      style={[{ width: size, height: size }, style]}
      resizeMode="scaleAspectFit"
    />
  );
}

// ---------------------------------------------------------------- text
const VARIANTS = {
  largeTitle: { ...UI.bold, fontSize: 34, lineHeight: 41, letterSpacing: -0.6 },
  title: { ...UI.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  title3: { ...UI.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  headline: { ...UI.semibold, fontSize: 17, lineHeight: 22 },
  body: { ...UI.regular, fontSize: 16, lineHeight: 23 },
  callout: { ...UI.regular, fontSize: 15, lineHeight: 21 },
  calloutStrong: { ...UI.semibold, fontSize: 15, lineHeight: 21 },
  subhead: { ...UI.regular, fontSize: 14, lineHeight: 19 },
  subheadStrong: { ...UI.semibold, fontSize: 14, lineHeight: 19 },
  footnote: { ...UI.regular, fontSize: 13, lineHeight: 18 },
  footnoteStrong: { ...UI.semibold, fontSize: 13, lineHeight: 18 },
  caption: { ...UI.regular, fontSize: 12, lineHeight: 16 },
  eyebrow: { ...UI.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.7, textTransform: "uppercase" },
};

export const T = forwardRef(function T({ v = "body", color, muted, accent, style, ...rest }, ref) {
  const { c } = useTheme();
  const col = color || (accent ? c.accent : muted ? c.muted : c.ink);
  return <Text ref={ref} style={[VARIANTS[v], { color: col }, style]} {...rest} />;
});

// ---------------------------------------------------------------- haptics
export const tap = () => Haptics.selectionAsync().catch(() => {});
export const thud = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

// ---------------------------------------------------------------- surfaces
export function Card({ children, style, onPress, accessibilityLabel, tone = "surface" }) {
  const { c } = useTheme();
  const bg = tone === "accent" ? c.accentSoft : tone === "inverse" ? (c.dark ? "#2C2C2E" : "#1C1C1E") : tone === "muted" ? c.surface2 : c.surface;
  if (!onPress) return <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, { backgroundColor: bg }, style, { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

/** A floating glass surface: real Liquid Glass on iOS 26, translucent fallback elsewhere. */
export function Glass({ style, children, interactive = false }) {
  const { c, name } = useTheme();
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme={name === "dark" ? "dark" : "light"} style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        { backgroundColor: c.glass, borderColor: c.glassBorder, borderWidth: StyleSheet.hairlineWidth },
        Platform.OS === "android" ? { elevation: 6 } : styles.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- buttons
export function Button({ title, onPress, icon, kind = "primary", style, disabled, accessibilityLabel }) {
  const { c } = useTheme();
  const bg = kind === "primary" ? c.accent : kind === "tonal" ? c.accentSoft : kind === "plain" ? "transparent" : c.surface2;
  const fg = kind === "primary" ? c.onAccent : kind === "tonal" ? c.accent : c.ink;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}
    >
      {icon ? <Icon name={icon} size={17} color={fg} /> : null}
      {title ? (
        <T v="calloutStrong" color={fg} numberOfLines={1}>
          {title}
        </T>
      ) : null}
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, size = 44, iconSize = 20, color, glass = false, style, active }) {
  const { c } = useTheme();
  const inner = <Icon name={name} size={iconSize} color={color || (active ? c.accent : c.ink)} />;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, style]}
    >
      {glass ? (
        <Glass interactive style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }]}>
          {inner}
        </Glass>
      ) : (
        <View style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }]}>{inner}</View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------- chips (never wrap)
export function Chip({ label, selected, onPress, icon, accessibilityLabel, tone, style, small }) {
  const { c } = useTheme();
  const bg = selected ? c.ink : tone === "surface2" ? c.surface2 : c.surface;
  const fg = selected ? c.bg : c.ink;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel || label}
      style={({ pressed }) => [styles.chip, small && styles.chipSmall, { backgroundColor: bg, opacity: pressed ? 0.75 : 1 }, style]}
    >
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <T v={small ? "caption" : "footnoteStrong"} color={fg} numberOfLines={1} style={styles.chipText}>
        {label}
      </T>
    </Pressable>
  );
}

/** Horizontal, scrollable row of chips. Chips keep their natural width and never wrap. */
export function ChipRow({ children, style, contentStyle }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={[{ gap: 8, paddingHorizontal: 16 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Segmented({ options, value, onChange, style }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: c.surface3 }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.segmentItem, on && { backgroundColor: c.surface, ...styles.segmentOn }]}
          >
            <T v={on ? "footnoteStrong" : "footnote"} color={on ? c.ink : c.ink2} numberOfLines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- misc
export function ProgressBar({ value, height = 6, style, label }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value || 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[{ height, borderRadius: height / 2, backgroundColor: c.surface3, overflow: "hidden" }, style]}
    >
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: c.accent }} />
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder, style, autoFocus, onSubmit, right, inputStyle }) {
  const { c } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: c.surface3 }, style]}>
      <Icon name="search" size={17} color={c.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        clearButtonMode="while-editing"
        accessibilityLabel={placeholder}
        style={[styles.searchInput, { color: c.ink }, inputStyle]}
      />
      {right}
    </View>
  );
}

export function ListRow({ title, subtitle, onPress, right, left, last, titleStyle, subtitleLines = 1, accessibilityLabel }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.surface2 : "transparent" },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
      ]}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {typeof title === "string" ? (
          <T v="calloutStrong" numberOfLines={1} style={titleStyle}>
            {title}
          </T>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <T v="footnote" muted numberOfLines={subtitleLines}>
              {subtitle}
            </T>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {right !== undefined ? right : onPress ? <Icon name="chevronRight" size={14} color={c.muted} /> : null}
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction, style }) {
  return (
    <View style={[styles.sectionTitle, style]}>
      <T v="title" numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <T v="callout" accent numberOfLines={1}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ title, body, icon = "info" }) {
  const { c } = useTheme();
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={32} color={c.muted} />
      <T v="headline" style={{ textAlign: "center" }}>
        {title}
      </T>
      {body ? (
        <T v="callout" muted style={{ textAlign: "center" }}>
          {body}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: 18 },
  shadow: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  button: { height: 46, borderRadius: 23, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  iconBtn: { alignItems: "center", justifyContent: "center" },
  chip: { height: 34, paddingHorizontal: 13, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  chipSmall: { height: 30, paddingHorizontal: 11, borderRadius: 15 },
  chipText: { flexShrink: 0 },
  segment: { flexDirection: "row", borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segmentOn: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  search: { height: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, minWidth: 0, ...UI.regular, fontSize: 16, paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, minHeight: 52 },
  sectionTitle: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 20, gap: 12 },
  empty: { alignItems: "center", gap: 10, paddingHorizontal: 40, paddingVertical: 60 },
});
