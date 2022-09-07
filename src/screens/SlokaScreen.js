import {
  Appbar,
  Button,
  Card,
  Divider,
  IconButton,
  Menu,
} from "react-native-paper";
import { ScrollView, StyleSheet, View } from "react-native";
import Text from "../components/base/Text";
import { useDispatch, useSelector } from "react-redux";
import { selectTheme, selectVerse, setTheme } from "../redux/slices/app";
import VerseCard from "../components/base/VerseCard";
import { useState } from "react";
import { darkTheme, lightTheme } from "../theme";
import ScreenHeader from "../components/base/ScreenHeader";
import { StatusBar } from "expo-status-bar";

export default function SlokaScreen({ navigation }) {
  const dispatch = useDispatch();
  const currentSloka = useSelector(selectVerse);
  const theme = useSelector(selectTheme);
  const styles = getStyles(theme);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);

  return (
    <ScrollView style={styles.screen} stickyHeaderIndices={[1]}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <ScreenHeader
        title={`Chapter ${currentSloka.chapter_number}, Verse ${currentSloka.verse_number}`}
        navigation={navigation}
        theme={theme}
      />
      <View style={styles.slokaCardContainer}>
        <IconButton icon="arrow-left-drop-circle" />
        <View style={styles.card}>
          <Text variant={"bodyMedium"} style={styles.cardContent}>
            {currentSloka.text}
          </Text>
        </View>
        <IconButton icon="arrow-right-drop-circle" />
      </View>
    </ScrollView>
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
