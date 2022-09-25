import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Divider,
  IconButton,
  List,
  Menu,
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
  setVerse,
} from "../redux/slices/app";
import VerseCard from "../components/base/VerseCard";
import { useCallback, useEffect, useState } from "react";
import { darkTheme, lightTheme } from "../theme";
import ScreenHeader from "../components/base/ScreenHeader";
import { StatusBar } from "expo-status-bar";
import DataAPI from "../gita-data/dataApi";
import { capitalizeFirstLetter, detectAndTransliterate } from "../utils";
import ListSelectionItem from "../components/base/ListSelectionItem";
import CollapsibleCard from "../components/base/CollapsibleCard";
import Modal from "../components/base/Modal";

export default function SlokaScreen({ navigation }) {
  const dispatch = useDispatch();
  const selectedVerse = useSelector(selectVerse);
  const theme = useSelector(selectTheme);
  const defaultLanguage = useSelector(
    selectDefaultLanguage
  ).devanagariToLanguage;
  const defaultTranslation = useSelector(selectDefaultTranslation);
  const defaultCommentary = useSelector(selectDefaultCommentary);
  const styles = getStyles(theme);
  const [currentSloka, setCurrentSloka] = useState(selectedVerse);
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
    setCurrentSloka(selectedVerse);
  }, [selectedVerse]);

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
    async function getFirstSloka() {
      const firstSloka = await DataAPI.getVerse(1, 1);
      setCurrentSloka(firstSloka);
    }

    getAllAuthors();
  }, []);

  const onAddMoreContent = async (author, type, isSelected) => {
    let newContent;
    if (!isSelected) {
      // remove the content
      newContent = contents.filter((content) => {
        if (content.author_id === author.id && content.type === type) {
          return false;
        }
        return true;
      });
      setContents(newContent);

      if (type === "translation") {
        const newSelectedTranslators = selectedTranslators.filter(
          (translator) => translator.id !== author.id
        );
        setSelectedTranslators(newSelectedTranslators);
      } else {
        const newSelectedCommentators = selectedCommentators.filter(
          (commentator) => commentator.id !== author.id
        );
        setSelectedCommentators(newSelectedCommentators);
      }
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
  };

  useEffect(() => {
    // console.log(
    //   "Need to persist these guys: ",
    //   selectedTranslators,
    //   selectedCommentators
    // );
  }, [selectedTranslators, selectedCommentators, showAddMoreDialog]);

  const contentExists = (author, type) => {
    return contents.some((content) => {
      return content.author_id === author.id && content.type === type;
    });
  };

  const changeSloka = async (goNext) => {
    const chapters = await DataAPI.getChapters();
    if (goNext) {
      const availableSlokasInChapter =
        chapters[currentSloka.chapter_number - 1].verses_count;
      if (currentSloka.verse_number < availableSlokasInChapter) {
        dispatch(
          setVerse(
            await DataAPI.getVerse(
              currentSloka.chapter_number,
              currentSloka.verse_number + 1
            )
          )
        );
      } else {
        if (
          currentSloka.chapter_number === chapters.length &&
          currentSloka.verse_number === availableSlokasInChapter
        ) {
          // do nothing
          return;
        }
        dispatch(
          setVerse(await DataAPI.getVerse(currentSloka.chapter_number + 1, 1))
        );
      }
    } else {
      if (currentSloka.verse_number > 1) {
        dispatch(
          setVerse(
            await DataAPI.getVerse(
              currentSloka.chapter_number,
              currentSloka.verse_number - 1
            )
          )
        );
      } else {
        if (
          currentSloka.chapter_number === 1 &&
          currentSloka.verse_number === 1
        ) {
          // do nothing
          return;
        }
        const availableSlokasInChapter =
          chapters[currentSloka.chapter_number - 1].verses_count;
        dispatch(
          setVerse(
            await DataAPI.getVerse(
              currentSloka.chapter_number - 1,
              availableSlokasInChapter
            )
          )
        );
      }
    }
  };

  if (!currentSloka) {
    return <ActivityIndicator animating={true} />;
  }

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
          <IconButton
            icon="arrow-left-drop-circle"
            style={{ zIndex: 5, elevation: 5 }}
            size={35}
            onPress={() => {
              changeSloka(false);
            }}
          />
        </View>
        <View style={{ ...styles.card }}>
          <Text variant={"bodyMedium"} style={styles.cardContent}>
            {detectAndTransliterate(currentSloka.text, defaultLanguage)}
          </Text>
          <Text variant={"bodyMedium"} style={styles.cardContent}>
            {detectAndTransliterate(
              currentSloka.transliteration,
              defaultLanguage
            )}
          </Text>
        </View>
        <View style={{ ...styles.slokaNavigators, right: 2 }}>
          <IconButton
            icon="arrow-right-drop-circle"
            size={35}
            style={{ zIndex: 5, elevation: 5 }}
            onPress={() => {
              changeSloka(true);
            }}
          />
        </View>
      </View>
      {contents.map((content) => (
        <CollapsibleCard
          key={content.id}
          title={`${capitalizeFirstLetter(
            content.lang
          )} ${capitalizeFirstLetter(content.type)} by ${content.authorName}`}
          content={content.description}
          theme={theme}
          menuProps={{
            menuItems: [
              {
                title: "Remove",
                onPress: () => {
                  onAddMoreContent(
                    { id: content.author_id },
                    content.type,
                    false
                  );
                },
              },
              {
                title: "Change Script",
              },
            ],
          }}
          defaultLanguage={defaultLanguage}
        />
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
          title={"Select One/More"}
          onDismiss={() => {
            setShowAddMoreDialog(false);
          }}
          contentContainerStyle={styles.modalContainer}
          showFooterActions={false}
          onSave={() => {
            setShowAddMoreDialog(false);
          }}
          onClose={() => {
            setShowAddMoreDialog(false);
          }}
          theme={theme}
        >
          <View style={{ maxHeight: "100%" }}>
            <ScrollView style={{ marginBottom: 20 }}>
              {allTranslators.map((translator) => (
                <View
                  style={{ marginVertical: 5 }}
                  key={translator.id + "translator"}
                >
                  <ListSelectionItem
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
                <View
                  style={{ marginVertical: 5 }}
                  key={commentator.id + "commentator"}
                >
                  <ListSelectionItem
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
      elevation: 2,
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
