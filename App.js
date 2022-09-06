import { Provider } from "react-redux";
import { store } from "./src/redux/store";
import Main from "./src/Main";
import { useCallback, useEffect, useState } from "react";
// import AppLoading from "expo-app-loading";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { View, Text } from "react-native";

SplashScreen.preventAutoHideAsync();

const fetchFonts = async () =>
  await Font.loadAsync({
    "readex-pro": require("./assets/ReadexPro.ttf"),
  });

export default function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    fetchFonts()
      .then(() => {
        console.log("Got the fonts...");
        setInitialized(true);
      })
      .catch((e) => {
        console.log("Failed to get fonts...", e);
        setInitialized(true);
      });
  }, []);

  const onLayoutRootView = useCallback(async () => {
    console.log("Hiding splash...", initialized);
    if (initialized) {
      await SplashScreen.hideAsync();
    }
  }, [initialized]);

  if (!initialized) {
    return null;
  }

  return (
    <Provider store={store}>
      <View
        style={{ width: "100%", height: "100%" }}
        onLayout={onLayoutRootView}
      >
        <Main />
      </View>
    </Provider>
  );
}
