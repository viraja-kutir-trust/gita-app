import { useDispatch, useSelector } from "react-redux";
import { selectTheme, setTheme } from "./redux/slices/app";
import { Button, Provider as PaperProvider } from "react-native-paper";
import { lightTheme, darkTheme } from "./theme";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./screens/HomeScreen";
import Text from "./components/base/Text";
import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SlokaScreen from "./screens/SlokaScreen";
import SelectVerseScreen from "./screens/SelectVerseScreen";
import FavoritesScreen from "./screens/FavoritesScreen";
import NotesScreen from "./screens/NotesScreen";

const Stack = createNativeStackNavigator();

const Main = () => {
  const theme = useSelector(selectTheme);
  const dispatch = useDispatch();
  //   const styles = getStyles(theme);

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Sloka"
            component={SlokaScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Select"
            component={SelectVerseScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Favorites"
            component={FavoritesScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Notes"
            component={NotesScreen}
            options={{
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
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
