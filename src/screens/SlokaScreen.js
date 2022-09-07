import {
  Appbar,
  Button,
  Card,
  Divider,
  IconButton,
  Menu,
} from "react-native-paper";
import { StyleSheet, View } from "react-native";
import Text from "../components/base/Text";
import { useDispatch, useSelector } from "react-redux";
import { selectTheme, selectVerse, setTheme } from "../redux/slices/app";
import VerseCard from "../components/base/VerseCard";
import { useState } from "react";
import { darkTheme, lightTheme } from "../theme";

export default function SlokaScreen({ navigation }) {
  const dispatch = useDispatch();
  const currentSloka = useSelector(selectVerse);
  const theme = useSelector(selectTheme);
  const styles = getStyles(theme);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.BackAction size={20} onPress={() => navigation.goBack()} />
        <Appbar.Content
          titleStyle={{ fontSize: 18 }}
          title={`Chapter ${currentSloka.chapter_number}, Verse ${currentSloka.verse_number}`}
        />
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
          {/* <Divider />
          <Menu.Item onPress={() => {}} title="Item 2" />
          <Divider />
          <Menu.Item onPress={() => {}} title="Item 3" /> */}
        </Menu>
        {/* </Appbar.Action> */}
      </Appbar.Header>
      <View style={styles.slokaCardContainer}>
        <IconButton icon="arrow-left-drop-circle" />
        <View style={styles.card}>
          <Text variant={"bodyMedium"} style={styles.cardContent}>
            {currentSloka.text}
          </Text>
        </View>
        <IconButton icon="arrow-right-drop-circle" />
      </View>
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    screen: {
      // paddingHorizontal: 10,
      flex: 1,
      backgroundColor: theme.colors.background,
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
      marginVertical: 20,
      width: "82%",
      borderRadius: 12,
      backgroundColor: theme.colors.primaryContainer,
    },
    cardContent: {
      margin: 10,
    },
  });
