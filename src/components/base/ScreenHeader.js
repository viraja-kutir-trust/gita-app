import { useEffect, useMemo, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Button, Divider, IconButton, Menu } from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import DataAPI from "../../gita-data/dataApi";
import {
  selectDefaultCommentary,
  selectDefaultLanguage,
  selectDefaultTranslation,
  setDefaultCommentary,
  setDefaultLanguage,
  setDefaultTranslation,
  setTheme,
} from "../../redux/slices/app";
import { darkTheme, lightTheme } from "../../theme";
import { capitalizeFirstLetter } from "../../utils";
import DropDown from "./DropDown";
import Modal from "./Modal";
import Text from "./Text";

export default function ScreenHeader(props) {
  const { navigation, title, theme } = props;
  const styles = getStyles(theme);
  const dispatch = useDispatch();
  const defaultLanguage = useSelector(selectDefaultLanguage);
  const defaultTranslation = useSelector(selectDefaultTranslation);
  const defaultCommentary = useSelector(selectDefaultCommentary);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);
  const [showModifyDefaults, setShowModifyDefaults] = useState(false);
  const [allTranslators, setAllTranslators] = useState([]);
  const [allCommentators, setAllCommentators] = useState([]);
  const [selectedTranslator, setSelectedTranslator] =
    useState(defaultTranslation);
  const [selectedCommentator, setSelectedCommentator] =
    useState(defaultCommentary);
  const [selectedLanguage, setSelectedLanguage] = useState(
    defaultLanguage.devanagariToLanguage
  );

  useEffect(() => {
    async function fetchAuthors() {
      const translators = await DataAPI.getTranslators();
      const commentators = await DataAPI.getCommenters();
      setAllTranslators(translators);
      setAllCommentators(commentators);
    }
    fetchAuthors();
  }, []);

  useEffect(() => {
    setSelectedTranslator(defaultTranslation);
    setSelectedCommentator(defaultCommentary);
    setSelectedLanguage(defaultLanguage.devanagariToLanguage);
  }, [
    defaultCommentary,
    defaultTranslation,
    defaultLanguage.devanagariToLanguage,
  ]);

  return (
    <Appbar.Header>
      <Appbar.BackAction size={20} onPress={() => navigation.goBack()} />
      <Appbar.Content titleStyle={{ fontSize: 18 }} title={title} />
      {/* <Appbar.Action> */}
      <Menu
        visible={headerMenuAnchor}
        onDismiss={() => {
          setHeaderMenuAnchor(null);
        }}
        anchor={
          <IconButton
            onPress={() => setHeaderMenuAnchor(true)}
            icon="dots-vertical"
          ></IconButton>
        }
      >
        <Menu.Item
          onPress={() => {
            dispatch(setTheme(theme.dark ? lightTheme : darkTheme));
            setHeaderMenuAnchor(null);
          }}
          title="Toggle Theme"
        />
        <Divider />
        <Menu.Item
          onPress={() => {
            setShowModifyDefaults(true);
            setHeaderMenuAnchor(null);
          }}
          title="Modify Defaults"
        />
      </Menu>
      {/* </Appbar.Action> */}
      <Modal
        theme={theme}
        visible={showModifyDefaults}
        title="Modify Defaults"
        showFooterActions
        onSave={() => {
          dispatch(setDefaultTranslation(selectedTranslator));
          dispatch(setDefaultCommentary(selectedCommentator));
          dispatch(
            setDefaultLanguage({ devanagariToLanguage: selectedLanguage })
          );
          setShowModifyDefaults(false);
        }}
        onClose={() => {
          setSelectedTranslator(defaultTranslation);
          setSelectedCommentator(defaultCommentary);
          setSelectedLanguage(defaultLanguage.devanagariToLanguage);
          setShowModifyDefaults(false);
        }}
      >
        <View style={{ paddingBottom: 0 }}>
          <DropDown
            header={"Script"}
            description={selectedLanguage}
            options={DataAPI.getTransliterationLanguages().map(
              (language) => language.name
            )}
            onChange={(newLanguage) => {
              setSelectedLanguage(newLanguage);
            }}
            theme={theme}
          />
          <DropDown
            header={"Default Translation"}
            description={`${capitalizeFirstLetter(selectedTranslator.lang)} - ${
              selectedTranslator.authorName
            }`}
            options={allTranslators.map(
              (translator) =>
                `${capitalizeFirstLetter(translator.lang)} - ${
                  translator.authorName
                }`
            )}
            onChange={(translatorText) => {
              const authorName = translatorText.split("- ")[1].trim();
              const translator = allTranslators.find(
                (t) => t.authorName === authorName
              );
              setSelectedTranslator(translator);
            }}
            theme={theme}
          />
          <DropDown
            header={"Default Commentary"}
            description={`${capitalizeFirstLetter(
              selectedCommentator.lang
            )} - ${selectedCommentator.authorName}`}
            options={allCommentators.map(
              (commentator) =>
                `${capitalizeFirstLetter(commentator.lang)} - ${
                  commentator.authorName
                }`
            )}
            onChange={(commentatorText) => {
              const authorName = commentatorText.split("- ")[1].trim();
              const translator = allCommentators.find(
                (t) => t.authorName === authorName
              );
              setSelectedCommentator(translator);
            }}
            theme={theme}
          />
        </View>
      </Modal>
    </Appbar.Header>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
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
