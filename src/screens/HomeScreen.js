import { Button, Card, Divider } from "react-native-paper";
import { ScrollView, StyleSheet, View } from "react-native";
import Text from "../components/base/Text";
import { useDispatch, useSelector } from "react-redux";
import { selectTheme, setTheme, setVerse } from "../redux/slices/app";
import { darkTheme, lightTheme } from "../theme";
import { useEffect, useState } from "react";
import VerseCard from "../components/base/VerseCard";
import DataAPI from "../gita-data/dataApi";
import { StatusBar } from "expo-status-bar";

export default function HomeScreen({ navigation }) {
  const theme = useSelector(selectTheme);
  const dispatch = useDispatch();
  const styles = getStyles(theme);
  const [randomSloka, setRandomSloka] = useState({});

  const actions = [
    {
      label: "Continue from where you left (Coming Soon)",
      onClick: () => {
        console.log("continue from where you left");
      },
    },
    {
      label: "Chapter & Verse",
      onClick: () => {
        navigation.navigate("Select");
      },
    },
    {
      label: "Favorites (Coming Soon)",
      onClick: () => {},
    },
    {
      label: "Toggle theme",
      onClick: () => {
        dispatch(setTheme(theme.dark ? lightTheme : darkTheme));
      },
    },
  ];

  async function getData() {
    const chapters = await DataAPI.getChapters();
    const verses = await DataAPI.getVerses();
    const translation = await DataAPI.getTranslations();
    const chapterCount = chapters.length;
    // Generate random number between 1 and chapterCount inclusive
    const randomChapter = Math.floor(Math.random() * chapterCount) + 1;
    const verseCount = chapters[randomChapter - 1].verses_count;
    // Generate random number between 1 and verseCount inclusive
    const randomVerse = Math.floor(Math.random() * verseCount) + 1;
    console.log(randomChapter, randomVerse);
    const verse = verses[randomChapter][randomVerse];
    // Find the translation of author_id 19 and verse_id equal to verse.verse_order
    try {
      const translationOfVerse = translation.find(
        (t) => t.author_id === 19 && t.verse_id === verse.verse_order
      );
      verse.translation = translationOfVerse;
    } catch (e) {
      console.log(e);
    }
    console.log(verse);
    setRandomSloka(verse);
  }

  useEffect(() => {
    getData();
  }, []);

  return (
    <ScrollView style={styles.screen}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <VerseCard
        sloka={randomSloka}
        title="Today's Sloka"
        theme={theme}
        showVerseId
        showTranslation
        onAction={() => {
          dispatch(setVerse(randomSloka));
          navigation.navigate("Sloka");
        }}
      />
      <View style={styles.actionsContainer}>
        {actions.map((action, index) => (
          <View style={styles.action} key={action.label}>
            {index === 0 && <Divider style={styles.divider} bold />}
            <Button
              mode="text"
              style={styles.actionButton}
              contentStyle={{ justifyContent: "flex-start" }}
              onPress={action.onClick}
            >
              <Text style={{ textAlign: "left" }} variant={"bodyLarge"}>
                {action.label}
              </Text>
            </Button>
            <Divider style={styles.divider} bold />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    screen: {
      padding: 10,
      width: "100%",
      height: "100%",
      backgroundColor: theme.colors.background,
      paddingTop: 30,
    },
    cardContainer: {
      margin: 20,
      borderRadius: 12,
      backgroundColor: theme.colors.primaryContainer,
    },
    cardTitle: {
      alignSelf: "center",
      marginTop: 8,
    },
    cardSubtitle: {
      alignSelf: "center",
      marginTop: 8,
    },
    cardContent: {
      alignSelf: "center",
      marginTop: 10,
      marginHorizontal: 30,
    },
    actionsContainer: {
      marginTop: 40,
      //   flex: 1,
      alignItems: "flex-start",
      justifyContent: "flex-start",
    },
    action: {
      width: "100%",
    },
    actionButton: {
      width: "100%",
      justifyContent: "flex-start",
      borderRadius: 2,
    },
    divider: {
      backgroundColor: theme.colors.primary,
    },
  });
