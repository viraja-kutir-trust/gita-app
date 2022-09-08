import {
  Appbar,
  Button,
  Card,
  Divider,
  IconButton,
  List,
  Menu,
  Modal,
  Portal,
} from "react-native-paper";
import { ScrollView, StyleSheet, View } from "react-native";
import Text from "../components/base/Text";
import { useDispatch, useSelector } from "react-redux";
import {
  selectDefaultCommentary,
  selectDefaultLanguage,
  selectDefaultTranslation,
  selectTheme,
  selectVerse,
  setTheme,
} from "../redux/slices/app";
import VerseCard from "../components/base/VerseCard";
import { useCallback, useEffect, useState } from "react";
import { darkTheme, lightTheme } from "../theme";
import ScreenHeader from "../components/base/ScreenHeader";
import { StatusBar } from "expo-status-bar";
import DataAPI from "../gita-data/dataApi";
import { capitalizeFirstLetter } from "../utils";
import ListSelectionItem from "../components/base/ListSelectionItem";

export default function SlokaScreen({ navigation }) {
  const dispatch = useDispatch();
  const currentSloka = useSelector(selectVerse);
  const theme = useSelector(selectTheme);
  const defaultLanguage = useSelector(selectDefaultLanguage);
  const defaultTranslation = useSelector(selectDefaultTranslation);
  const defaultCommentary = useSelector(selectDefaultCommentary);
  const styles = getStyles(theme);
  const [showAddMoreDialog, setShowAddMoreDialog] = useState(false);
  const [allTranslators, setAllTranslators] = useState([]);
  const [allCommentators, setAllCommentators] = useState([]);
  const [selectedTranslators, setSelectedTranslators] = useState([
    defaultTranslation,
  ]);
  const [selectedCommentators, setSelectedCommentators] = useState([
    defaultCommentary,
  ]);

  const [contents, setContents] = useState([]);

  useEffect(() => {
    async function getDefaults() {
      if (currentSloka && defaultTranslation && defaultCommentary) {
        const currentDefaults = [];
        const currentTranslation = await DataAPI.getTranslationByAuthor(
          currentSloka.id,
          defaultTranslation.id
        );
        const currentCommentary = await DataAPI.getCommentaryByAuthor(
          currentSloka.id,
          defaultCommentary.id
        );
        currentDefaults.push(currentTranslation);
        currentDefaults.push(currentCommentary);
        setContents(currentDefaults);
      }
    }

    getDefaults();
  }, [currentSloka, defaultTranslation, defaultCommentary]);

  useEffect(() => {
    async function getAllAuthors() {
      const translators = await DataAPI.getTranslators();
      const commentators = await DataAPI.getCommenters();
      setAllTranslators(translators);
      setAllCommentators(commentators);
    }

    getAllAuthors();
  }, []);

  const onAddMoreContent = useCallback(async (author, type, isSelected) => {
    let newContent;
    if (!isSelected) {
      // remove the content
      newContent = contents.filter(
        (content) => content.author_id !== author.id && content.type !== type
      );
      setContents(newContent);
      return;
    }
    if (type === "translation") {
      newContent = await DataAPI.getTranslationByAuthor(
        currentSloka.id,
        author.id
      );
      selectedTranslators.push(author);
      setSelectedTranslators(selectedTranslators);
    } else {
      newContent = await DataAPI.getCommentaryByAuthor(
        currentSloka.id,
        author.id
      );
      selectedCommentators.push(author);
      setSelectedCommentators(selectedCommentators);
    }
    setContents((prev) => [...prev, newContent]);
  }, []);

  useEffect(() => {
    console.log(
      "Need to persist these guys: ",
      selectedTranslators,
      selectedCommentators
    );
  }, [selectedTranslators, selectedCommentators]);

  const contentExists = (author, type) => {
    return contents.some((content) => {
      return content.author_id === author.id && content.type === type;
    });
  };

  return (
    <ScrollView stickyHeaderIndices={[1]} style={styles.screen}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <ScreenHeader
        title={`Chapter ${currentSloka.chapter_number}, Verse ${currentSloka.verse_number}`}
        navigation={navigation}
        theme={theme}
      />
      <View style={styles.slokaCardContainer}>
        <View style={{ ...styles.slokaNavigators, left: 2 }}>
          <IconButton icon="arrow-left-drop-circle" size={35} />
        </View>
        <View style={{ ...styles.card }}>
          <Text variant={"bodyMedium"} style={styles.cardContent}>
            {currentSloka.text}
          </Text>
          <Text variant={"bodyMedium"} style={styles.cardContent}>
            {currentSloka.transliteration}
          </Text>
        </View>
        <View style={{ ...styles.slokaNavigators, right: 2 }}>
          <IconButton icon="arrow-right-drop-circle" size={35} />
        </View>
      </View>
      {contents.map((content) => (
        <View key={content.id} style={styles.card}>
          <Text
            style={styles.cardTitle}
            variant={"titleMedium"}
          >{`${capitalizeFirstLetter(content.lang)} ${capitalizeFirstLetter(
            content.type
          )} by ${content.authorName}`}</Text>
          <Text variant={"bodyMedium"} style={styles.cardContent}>
            {content.description}
          </Text>
        </View>
      ))}
      <Button
        icon="plus"
        mode="contained"
        style={styles.addCommentaryButton}
        onPress={() => {
          setShowAddMoreDialog(true);
        }}
      >
        <Text style={{ color: theme.colors.surface }}>Add More</Text>
      </Button>
      <Portal>
        <Modal
          visible={showAddMoreDialog}
          onDismiss={() => {
            setShowAddMoreDialog(false);
          }}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={{ maxHeight: "100%" }}>
            <Text variant={"titleMedium"} style={styles.modalTitle}>
              Select One/More
            </Text>
            <IconButton
              icon={"close"}
              iconColor="maroon"
              onPress={() => setShowAddMoreDialog(false)}
              style={styles.modalCloseIcon}
            />
            <ScrollView>
              {allTranslators.map((translator) => (
                <View style={{ marginVertical: 5 }}>
                  <ListSelectionItem
                    key={translator.id + "translator"}
                    text={`${capitalizeFirstLetter(
                      translator.lang
                    )} Translation by ${translator.authorName}`}
                    theme={theme}
                    defaultSelected={contentExists(translator, "translation")}
                    onPress={(isSelected) => {
                      onAddMoreContent(translator, "translation", isSelected);
                    }}
                  />
                </View>
              ))}
              {allCommentators.map((commentator) => (
                <View style={{ marginVertical: 5 }}>
                  <ListSelectionItem
                    key={commentator.id + "commentator"}
                    text={`${capitalizeFirstLetter(
                      commentator.lang
                    )} Commentary by ${commentator.authorName}`}
                    theme={theme}
                    defaultSelected={contentExists(commentator, "commentary")}
                    onPress={(isSelected) => {
                      onAddMoreContent(commentator, "commentary", isSelected);
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    screen: {
      paddingBottom: 20,
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    slokaNavigators: {
      position: "absolute",
      elevation: 5,
      zIndex: 2,
      opacity: 0.8,
    },
    slokaCardContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    card: {
      minHeight: 100,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      marginVertical: 20,
      width: "86%",
      borderRadius: 12,
      backgroundColor: theme.colors.primaryContainer,
      paddingBottom: 15,
    },
    cardTitle: {
      color: theme.colors.onPrimaryContainer,
      marginTop: 10,
      maxWidth: "80%",
      textAlign: "center",
    },
    cardContent: {
      marginHorizontal: 10,
      marginTop: 15,
      textAlign: "center",
      maxWidth: "80%",
    },
    addCommentaryButton: {
      alignSelf: "center",
      height: 40,
      borderRadius: 16,
      marginBottom: 40,
    },
    modalContainer: {
      backgroundColor: theme.colors.surface,
      padding: 20,
      // minWidth: "80%",
      width: 360,
      alignSelf: "center",
      maxHeight: "95%",
    },
    modalTitle: {
      textAlign: "center",
      marginBottom: 15,
    },
    modalCloseIcon: {
      position: "absolute",
      top: -13,
      right: -13,
    },
  });
