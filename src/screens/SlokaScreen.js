import {
  ActivityIndicator,
  Button,
  IconButton,
  Portal,
  Snackbar,
  TextInput,
} from "react-native-paper";
import { ScrollView, StyleSheet, View } from "react-native";
import Text from "../components/base/Text";
import { useDispatch, useSelector } from "react-redux";
import {
  addOrRemoveFavorite,
  modifyNote,
  selectDefaultCommentary,
  selectDefaultLanguage,
  selectDefaultTranslation,
  selectFavorites,
  selectMoreCommentators,
  selectMoreTranslators,
  selectNotes,
  selectTheme,
  selectVerse,
  setMoreDefaultCommentators,
  setMoreDefaultTranslators,
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
  const moreDefaultTranslators = useSelector(selectMoreTranslators) || [];
  const moreDefaultCommentators = useSelector(selectMoreCommentators) || [];
  const isFavorite = useSelector(selectFavorites)?.find(
    (verse) => verse && selectedVerse && verse.id === selectedVerse.id
  );
  const note =
    useSelector(selectNotes)[
      `${selectedVerse.chapter_number}:${selectedVerse.verse_number}`
    ];
  const styles = getStyles(theme);
  const [currentSloka, setCurrentSloka] = useState(selectedVerse);
  const [showAddMoreDialog, setShowAddMoreDialog] = useState(false);
  const [allTranslators, setAllTranslators] = useState([]);
  const [allCommentators, setAllCommentators] = useState([]);
  const [selectedTranslators, setSelectedTranslators] = useState([
    defaultTranslation,
    ...moreDefaultTranslators,
  ]);
  const [selectedCommentators, setSelectedCommentators] = useState([
    defaultCommentary,
    ...moreDefaultCommentators,
  ]);

  const [forceRemove, setForceRemove] = useState(false);
  const [contents, setContents] = useState([]);
  const [saveSelected, setSaveSelected] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, text: "" });
  const [showModifyNote, setShowModifyNote] = useState(false);
  const [currentNoteText, setCurrentNoteText] = useState(note);

  useEffect(() => {
    setCurrentSloka(selectedVerse);
  }, [selectedVerse]);

  async function getMoreContents(
    contentsProvided,
    moreDefaultTranslators,
    moreDefaultCommentators,
    currentSloka
  ) {
    let currentContents = contentsProvided || [];
    if (moreDefaultTranslators?.length) {
      for (let translator of moreDefaultTranslators) {
        if (
          !currentContents.find(
            (content) =>
              content.author_id === translator.id &&
              content.type === "translation"
          )
        ) {
          const translation = await DataAPI.getTranslationByAuthor(
            currentSloka.id,
            translator.id
          );
          currentContents.push(translation);
        }
      }
    }
    if (moreDefaultCommentators?.length) {
      for (let commentator of moreDefaultCommentators) {
        if (
          !currentContents.find(
            (content) =>
              content.author_id === commentator.id &&
              content.type === "commentary"
          )
        ) {
          const commentary = await DataAPI.getCommentaryByAuthor(
            currentSloka.id,
            commentator.id
          );
          currentContents.push(commentary);
        }
      }
    }
    setContents(currentContents);
  }

  useEffect(() => {
    getMoreContents(
      null,
      [defaultTranslation, ...moreDefaultTranslators],
      [defaultCommentary, ...moreDefaultCommentators],
      currentSloka
    );
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
    if (!isSelected) {
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
      if (
        !selectedTranslators.find((translator) => translator.id === author.id)
      ) {
        selectedTranslators.push(author);
        setSelectedTranslators(selectedTranslators);
      }
    } else {
      if (
        !selectedCommentators.find(
          (commentator) => commentator.id === author.id
        )
      ) {
        selectedCommentators.push(author);
        setSelectedCommentators(selectedCommentators);
      }
    }
  };

  useEffect(() => {
    if (saveSelected || forceRemove) {
      getMoreContents(
        null,
        selectedTranslators,
        selectedCommentators,
        currentSloka
      );
      dispatch(setMoreDefaultTranslators(selectedTranslators));
      dispatch(setMoreDefaultCommentators(selectedCommentators));
      setSaveSelected(false);
      setForceRemove(false);
    }
  }, [
    saveSelected,
    forceRemove,
    selectedTranslators,
    selectedCommentators,
    currentSloka,
  ]);

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
    <View style={styles.screen}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <ScreenHeader
        title={`Chapter ${currentSloka.chapter_number}, Verse ${currentSloka.verse_number}`}
        navigation={navigation}
        theme={theme}
        customActions={[
          <IconButton
            icon="lead-pencil"
            onPress={() => {
              setShowModifyNote(true);
            }}
          />,
          <IconButton
            icon={isFavorite ? "star" : "star-outline"}
            onPress={() => {
              dispatch(
                addOrRemoveFavorite({
                  type: isFavorite ? "remove" : "add",
                  verse: selectedVerse,
                })
              );
              setSnackbar({
                visible: true,
                text: isFavorite
                  ? "Verse removed from favorites"
                  : "Verse added to favorites",
              });
            }}
          />,
        ]}
      />
      <ScrollView>
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
            contentLanguage={content.lang}
            theme={theme}
            menuProps={{
              menuItems: [
                {
                  title: "Remove",
                  onPress: () => {
                    onAddMoreContent(
                      { id: content.author_id },
                      content.type,
                      false,
                      true
                    );
                    setForceRemove(true);
                  },
                  disabled: [
                    defaultTranslation.id,
                    defaultCommentary.id,
                  ].includes(content.author_id),
                },
                {
                  title: "Change Script",
                },
              ],
            }}
            defaultLanguage={defaultLanguage}
          />
        ))}
        {note && (
          <CollapsibleCard
            key={"note"}
            title={"Note"}
            content={note}
            theme={theme}
            menuProps={{
              menuItems: [
                {
                  title: "Edit",
                  onPress: () => {
                    setShowModifyNote(true);
                  },
                },
                {
                  title: "Remove",
                  onPress: () => {
                    dispatch(
                      modifyNote({ type: "remove", verse: selectedVerse })
                    );
                  },
                },
              ],
            }}
          />
        )}
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
      </ScrollView>
      <Portal>
        <Modal
          visible={showAddMoreDialog}
          title={"Select One/More"}
          onDismiss={() => {
            setShowAddMoreDialog(false);
            setSelectedTranslators([
              defaultTranslation,
              ...moreDefaultTranslators,
            ]);
            setSelectedCommentators([
              defaultCommentary,
              ...moreDefaultCommentators,
            ]);
          }}
          showFooterActions={true}
          onSave={() => {
            setShowAddMoreDialog(false);
            setSaveSelected(true);
          }}
          onClose={() => {
            setShowAddMoreDialog(false);
            setSelectedTranslators([
              defaultTranslation,
              ...moreDefaultTranslators,
            ]);
            setSelectedCommentators([
              defaultCommentary,
              ...moreDefaultCommentators,
            ]);
          }}
          theme={theme}
        >
          <View style={{ maxHeight: "90%" }}>
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
                    forceState={defaultTranslation.id === translator.id}
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
                    forceState={defaultCommentary.id === commentator.id}
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
      <Portal>
        <Modal
          visible={showModifyNote}
          title={"Add Notes"}
          onDismiss={() => {
            setShowModifyNote(false);
            setCurrentNoteText(note);
          }}
          contentContainerStyle={{
            width: "98%",
            minWidth: "98%",
            marginLeft: 4,
          }}
          showFooterActions={true}
          theme={theme}
          onClose={() => {
            setShowModifyNote(false);
            setCurrentNoteText(note);
          }}
          onSave={() => {
            setShowModifyNote(false);
            dispatch(
              modifyNote({
                type: "edit",
                verse: selectedVerse,
                note: currentNoteText,
              })
            );
          }}
        >
          <TextInput
            mode="flat"
            multiline
            placeholder="Type here..."
            style={{
              minHeight: 150,
              marginBottom: 20,
              maxHeight: "85%",
            }}
            defaultValue={currentNoteText}
            onChangeText={(e) => {
              setCurrentNoteText(e);
            }}
          />
        </Modal>
      </Portal>
      <Snackbar
        visible={snackbar.visible}
        duration={4000}
        onDismiss={() => {
          setSnackbar({ visible: false, text: "" });
        }}
      >
        {snackbar.text}
      </Snackbar>
    </View>
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
      maxHeight: "100%",
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
