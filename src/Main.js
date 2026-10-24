import { useDispatch, useSelector } from "react-redux";
import { selectTheme, setTheme } from "./redux/slices/app";
import { Button, Provider as PaperProvider } from "react-native-paper";
import { lightTheme, darkTheme } from "./theme";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./screens/HomeScreen";
import Text from "./components/base/Text";
import { useEffect, useMemo } from "react";
import {
  NavigationContainer,
  DefaultTheme as NavLightTheme,
  DarkTheme as NavDarkTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SlokaScreen from "./screens/SlokaScreen";
import SelectVerseScreen from "./screens/SelectVerseScreen";
import FavoritesScreen from "./screens/FavoritesScreen";
import NotesScreen from "./screens/NotesScreen";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// React Navigation v7 requires a theme shaped like its own (incl. `fonts`),
// so derive one from the Paper (MD3) theme instead of passing Paper's directly.
const toNavigationTheme = (theme) => {
  const base = theme.dark ? NavDarkTheme : NavLightTheme;
  return {
    ...base,
    dark: !!theme.dark,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.background,
      text: theme.colors.onBackground,
      border: theme.colors.outlineVariant,
      notification: theme.colors.error,
    },
  };
};

const Main = () => {
  const theme = useSelector(selectTheme);
  const dispatch = useDispatch();
  const navigationTheme = useMemo(() => toNavigationTheme(theme), [theme]);
  //   const styles = getStyles(theme);

  return (
    <View
      style={{ width: "100%", height: "100%" }}
      // onLayout={onLayoutRootView}
      backgroundColor={theme.colors.background}
    >
      <PaperProvider theme={theme}>
        <NavigationContainer theme={navigationTheme}>
          <Tab.Navigator
            initialRouteName="Home"
            screenOptions={{
              tabBarActiveBackgroundColor: theme.colors.background,
              tabBarInactiveBackgroundColor: theme.colors.background,
              tabBarActiveTintColor: theme.colors.primary,
              tabBarInactiveTintColor: theme.colors.tertiary,
              tabBarStyle: {
                // paddingBottom: 5,
              },
            }}
          >
            <Tab.Screen
              name="Home"
              component={HomeScreen}
              options={{
                headerShown: false,
                // tabBarLabel: 'Home',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons
                    name="home"
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
            <Tab.Screen
              name="Select"
              component={SelectVerseScreen}
              options={{
                headerShown: false,
                // tabBarLabel: 'Home',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons
                    name="magnify"
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
            <Tab.Screen
              name="Sloka"
              component={SlokaScreen}
              options={{
                headerShown: false,
                // tabBarLabel: 'Home',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons
                    name="book-open"
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
            <Tab.Screen
              name="Favorites"
              component={FavoritesScreen}
              options={{
                headerShown: false,
                // tabBarLabel: 'Home',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons
                    name="star"
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
            <Tab.Screen
              name="Notes"
              component={NotesScreen}
              options={{
                headerShown: false,
                // tabBarLabel: 'Home',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons
                    name="lead-pencil"
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </View>
  );
};
// const getStyles = (theme) =>
//   StyleSheet.create({
//     container: {
//       flex: 1,
//       backgroundColor: theme?.colors?.background,
//       alignItems: "center",
//       justifyContent: "center",
//     },
//   });

export default Main;
