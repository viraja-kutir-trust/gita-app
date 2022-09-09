import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Divider,
  IconButton,
  Menu,
} from "react-native-paper";
import { TouchableOpacity } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Text from "../components/base/Text";
import DataAPI from "../gita-data/dataApi";
import { selectTheme, setVerse } from "../redux/slices/app";
import VerseCard from "../components/base/VerseCard";
import ScreenHeader from "../components/base/ScreenHeader";
import { StatusBar } from "expo-status-bar";

export default function SelectVerseScreen(props) {
  const { navigation } = props;
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const styles = getStyles(theme);
  const [chapters, setChapters] = useState([]);
  const [verses, setVerses] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [currentVerse, setCurrentVerse] = useState(null);

  const [showChapters, setShowChapters] = useState(false);
  const [showVerses, setShowVerses] = useState(false);

  const [chapterLayout, setChapterLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [verseLayout, setVerseLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const chapterMenuRef = useRef();

  const onChapterLayout = (event) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    console.log(event.nativeEvent.layout);
    setChapterLayout({ x, y, width, height });
  };

  const onVerseLayout = (event) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setVerseLayout({ x, y, width, height });
  };

  const selectionComponent = (header, description, onLayout, onPress) => (
    <TouchableOpacity
      style={styles.selectionContainer}
      onPress={onPress}
      onLayout={onLayout}
    >
      <View style={styles.selectionParent}>
        <View style={styles.selectionTextParent}>
          <Text numberOfLines={1} variant={"titleMedium"}>
            {header}
          </Text>
          <Text numberOfLines={1} variant={"labelMedium"}>
            {description}
          </Text>
        </View>
        <IconButton
          icon={"arrow-down-drop-circle"}
          onClick={() => {
            setShowChapters(true);
          }}
        />
      </View>
    </TouchableOpacity>
  );

  useEffect(() => {
    async function getData() {
      const chapters = await DataAPI.getChapters();
      const verses = await DataAPI.getVerses();
      setChapters(chapters);
      setVerses(verses);
      setCurrentChapter(1);
      setCurrentVerse(verses[1][1]);
    }
    getData();
  }, []);

  if (!currentChapter || !currentVerse) {
    return <ActivityIndicator />;
  }

  return (
    <ScrollView style={styles.screen} stickyHeaderIndices={[1]}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <ScreenHeader
        navigation={navigation}
        title="Select Verse"
        theme={theme}
      />
      {selectionComponent(
        `Chapter ${currentChapter} - ${
          chapters[currentChapter - 1].name_translation
        }`,
        chapters[currentChapter - 1].name_meaning,
        onChapterLayout,
        () => {
          setShowChapters(true);
        }
      )}
      {selectionComponent(
        `Verse ${currentVerse?.verse_number || 1}`,
        currentVerse?.text,
        onVerseLayout,
        () => {
          setShowVerses(true);
        }
      )}
      <Menu
        visible={showChapters}
        onDismiss={() => setShowChapters(false)}
        anchor={{ x: chapterLayout.x, y: chapterLayout.y }}
        style={{
          ...styles.selectionMenuContainer,
          width: chapterLayout.width || "auto",
        }}
        contentStyle={{ borderRadius: 12, fontFamily: "readex-pro" }}
      >
        {chapters.map((chapter, index) => (
          <View key={chapter.id}>
            <Menu.Item
              key={chapter.id}
              onPress={() => {
                setCurrentChapter(index + 1);
                setCurrentVerse(verses[index + 1][1]);
                setShowChapters(false);
              }}
              title={`Chapter ${index + 1} - ${chapter.name_translation}`}
              style={{ width: "100%", minWidth: "100%", maxWidth: "100%" }}
              contentStyle={styles.selectionText}
              titleStyle={styles.selectionText}
            />
            {index !== chapters.length - 1 && <Divider id={chapter.id} />}
          </View>
        ))}
      </Menu>
      <Menu
        visible={showVerses}
        onDismiss={() => setShowVerses(false)}
        anchor={{ x: verseLayout.x, y: verseLayout.y }}
        style={{
          ...styles.selectionMenuContainer,
          width: verseLayout.width || "auto",
        }}
        contentStyle={{ borderRadius: 12, fontFamily: "readex-pro" }}
      >
        {Object.entries(verses[currentChapter]).map((verse, index) => (
          <View key={verse[1].id}>
            <Menu.Item
              key={verse[1].id}
              onPress={() => {
                setCurrentVerse(verse[1]);
                setShowVerses(false);
              }}
              title={`${index + 1} - ${verse[1].text}`}
              style={{ width: "100%", minWidth: "100%", maxWidth: "100%" }}
              contentStyle={styles.selectionText}
              titleStyle={styles.selectionText}
            />
            {index !== chapters.length - 1 && <Divider id={verse[1].id} />}
          </View>
        ))}
      </Menu>
      <VerseCard
        sloka={currentVerse}
        showVerseId
        theme={theme}
        showTranslation
        onAction={() => {
          dispatch(setVerse(currentVerse));
          navigation.navigate("Sloka");
        }}
      />
    </ScrollView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme?.colors?.background,
    },
    selectionContainer: {
      borderRadius: 12,
      margin: 20,
      padding: 8,
      height: 65,
      backgroundColor: theme?.colors?.tertiaryContainer,
      flexDirection: "row",
      alignItems: "center",
    },
    selectionParent: {
      justifyContent: "space-between",
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      //   height: 40,
      marginLeft: 10,
    },
    selectionTextParent: {
      justifyContent: "space-between",
      flex: 1,
      height: 40,
    },
    selectionMenuContainer: {
      //   marginTop: 12,
      //   marginLeft: 13,
      borderRadius: 12,
    },
    selectionText: {
      fontFamily: "readex-pro",
      width: "100%",
      minWidth: "100%",
      maxWidth: "100%",
    },
  });
