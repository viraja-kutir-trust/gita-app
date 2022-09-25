import { Provider } from "react-redux";
import { store, persistor } from "./src/redux/store";
import Main from "./src/Main";
import { useCallback, useEffect, useState } from "react";
// import AppLoading from "expo-app-loading";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { View, Text } from "react-native";
import { PersistGate } from "redux-persist/integration/react";

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
        setInitialized(true);
      })
      .catch((e) => {
        setInitialized(true);
      });
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (initialized) {
      await SplashScreen.hideAsync();
    }
  }, [initialized]);

  if (!initialized) {
    return null;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={<Text>Loading...</Text>} persistor={persistor}>
        <View
          style={{ width: "100%", height: "100%" }}
          onLayout={onLayoutRootView}
        >
          <Main />
        </View>
      </PersistGate>
    </Provider>
  );
}
