import { NativeTabs } from "expo-router/native-tabs";
import { fonts, useTheme, UI } from "../../ui/theme";

// Native tab bar: the system UITabBar on iOS (Liquid Glass on iOS 26, with the
// search tab as its own button) and the Material 3 navigation bar on Android.
export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <NativeTabs
      tintColor={c.accent}
      iconColor={{ default: c.ink2, selected: c.accent }}
      labelStyle={{ default: { ...UI.medium, color: c.ink2 }, selected: { ...UI.semibold, color: c.accent } }}
      backgroundColor={c.bg}
      indicatorColor={c.accentSoft2}
      rippleColor={c.accentSoft}
      minimizeBehavior="onScrollDown"
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "sun.max", selected: "sun.max.fill" }} md="wb_sunny" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chapters">
        <NativeTabs.Trigger.Label>Chapters</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "book", selected: "book.fill" }} md="menu_book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "bookmark", selected: "bookmark.fill" }} md="bookmarks" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
