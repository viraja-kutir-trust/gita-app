import { StatusBar } from "expo-status-bar";
import { View, ScrollView } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import MyBottomNavigation from "../components/base/BottomNavigation";
import ScreenHeader from "../components/base/ScreenHeader";
import Text from "../components/base/Text";
import VerseBrief from "../components/base/VerseBrief";
import DataAPI from "../gita-data/dataApi";
import {
  modifyNote,
  selectNotes,
  selectTheme,
  setVerse,
} from "../redux/slices/app";

export default function NotesScreen({ navigation }) {
  const theme = useSelector(selectTheme);
  const dispatch = useDispatch();
  const styles = getStyles(theme);
  const notes = useSelector(selectNotes);
  const verseIds = Object.keys(notes);
  const notesContents = Object.values(notes);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <ScreenHeader title={"Notes"} navigation={navigation} theme={theme} />
      <ScrollView>
        <View>
          {notesContents?.length > 0 ? (
            notesContents.map((note, index) => {
              const [chapter_number, verse_number] = verseIds[index].split(":");
              const pseudoVerse = {
                id: verseIds[index],
                chapter_number,
                verse_number,
                text: note,
              };
              return (
                <VerseBrief
                  verse={pseudoVerse}
                  theme={theme}
                  style={{
                    container: { marginHorizontal: 10, marginVertical: 5 },
                  }}
                  onPress={() => {
                    DataAPI.getVerse(chapter_number, verse_number).then(
                      (verse) => {
                        dispatch(setVerse(verse));
                        navigation.navigate("Sloka");
                      }
                    );
                  }}
                  actions={[
                    {
                      title: "Delete note",
                      onPress: () => {
                        dispatch(
                          modifyNote({
                            type: "remove",
                            verse: pseudoVerse,
                          })
                        );
                      },
                    },
                  ]}
                />
              );
            })
          ) : (
            <Text style={{ alignSelf: "center", marginTop: "50%" }}>
              No notes added.
            </Text>
          )}
        </View>
      </ScrollView>
      <MyBottomNavigation theme={theme} />
    </View>
  );
}

const getStyles = (theme) => ({
  container: {},
});
