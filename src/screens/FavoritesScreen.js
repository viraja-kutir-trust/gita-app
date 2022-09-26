import { StatusBar } from "expo-status-bar";
import { View, ScrollView } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import ScreenHeader from "../components/base/ScreenHeader";
import Text from "../components/base/Text";
import VerseBrief from "../components/base/VerseBrief";
import {
  addOrRemoveFavorite,
  selectFavorites,
  selectTheme,
  setVerse,
} from "../redux/slices/app";

export default function FavoritesScreen({ navigation }) {
  const theme = useSelector(selectTheme);
  const dispatch = useDispatch();
  const styles = getStyles(theme);
  const favorites = useSelector(selectFavorites).filter((fav) => !!fav);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <ScreenHeader title={"Favorites"} navigation={navigation} theme={theme} />
      <ScrollView>
        <View>
          {favorites?.length > 0 ? (
            favorites.map((favorite) => (
              <VerseBrief
                verse={favorite}
                theme={theme}
                style={{
                  container: { marginHorizontal: 10, marginVertical: 5 },
                }}
                onPress={() => {
                  console.log("Hi");
                  dispatch(setVerse(favorite));
                  navigation.navigate("Sloka");
                }}
                actions={[
                  {
                    title: "Remove from favorites",
                    onPress: () => {
                      dispatch(
                        addOrRemoveFavorite({
                          type: "remove",
                          verse: favorite,
                        })
                      );
                    },
                  },
                ]}
              />
            ))
          ) : (
            <Text style={{ alignSelf: "center", marginTop: "50%" }}>
              No favorites added.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme) => ({
  container: {},
});
