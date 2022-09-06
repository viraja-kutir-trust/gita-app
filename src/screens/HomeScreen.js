import { Button, Card, Divider } from "react-native-paper";
import { StyleSheet, View } from "react-native";
import Text from "../components/base/Text";
import { useDispatch, useSelector } from "react-redux";
import { selectTheme, setTheme } from "../redux/slices/app";
import { darkTheme, lightTheme } from "../theme";
import { useEffect, useState } from "react";
import chapters from "../gita-data/chapters.json";
import verses from "../gita-data/verses-parsed.json";
import translation from "../gita-data/translation.json";

export default function HomeScreen({ navigation }) {
  const theme = useSelector(selectTheme);
  const dispatch = useDispatch();
  const styles = getStyles(theme);
  const sloka = {
    source: {
      language: "DE",
      content:
        "अपि चेदसि पापेभ्यः सर्वेभ्यः पापकृत्तमः। \n सर्वं ज्ञानप्लवेनैववृजिनं सन्तरिष्यसि ।।",
    },
    meaning: {
      language: "EN",
      content:
        "Even if you be the worst sinner among all sinners, still you will cross over all the wickedness with the raft of Knowledge alone.",
    },
  };
  const [randomSloka, setRandomSloka] = useState({});

  const actions = [
    {
      label: "Continue from where you left",
      onClick: () => {
        console.log("continue from where you left");
      },
    },
    {
      label: "Chapter & Verse",
      onClick: () => {},
    },
    {
      label: "Favorites",
      onClick: () => {},
    },
    {
      label: "Toggle theme",
      onClick: () => {
        dispatch(setTheme(theme.dark ? lightTheme : darkTheme));
      },
    },
  ];

  useEffect(() => {
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
  }, []);

  return (
    <View style={styles.screen}>
      <Card style={styles.cardContainer}>
        <Text style={styles.cardTitle} variant={"titleMedium"}>
          Today's Sloka
        </Text>
        <Text style={styles.cardSubtitle} variant={"labelLarge"}>
          Chapter {randomSloka.chapter_number}, Verse {randomSloka.verse_number}
        </Text>
        <Text style={styles.cardContent} variant="titleMedium">
          {randomSloka.text}
        </Text>
        <Text style={styles.cardContent} variant="bodyMedium">
          {randomSloka.translation?.description}
        </Text>
        <Button
          icon={"arrow-right-box"}
          onPress={() => {
            navigation.navigate("Sloka");
          }}
        >
          <Text style={{ color: theme.colors.secondary }}>See more</Text>
        </Button>
      </Card>
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
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    screen: {
      padding: 10,
      width: "100%",
      height: "100%",
      backgroundColor: theme.colors.background,
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
