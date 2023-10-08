import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { ActivityIndicator, Button, Card } from "react-native-paper";
import DataAPI from "../../gita-data/dataApi";
import { detectAndTransliterate } from "../../utils";
import Text from "./Text";

export default function VerseCard(props) {
  const {
    title,
    showVerseId,
    sloka,
    theme,
    onAction,
    showTranslation,
    defaultLanguage,
  } = props;
  const styles = getStyles(theme);
  const [verse, setVerse] = useState(sloka);
  const [translation, setTranslation] = useState(sloka?.translation);

  useEffect(() => {
    const newVerse = { ...sloka };
    newVerse.text = detectAndTransliterate(sloka.text, defaultLanguage);
    if (newVerse.translation) {
      newVerse.translation = detectAndTransliterate(
        sloka.translation.description,
        defaultLanguage
      );
      setTranslation(newVerse.translation);
    } else if (translation) {
      const newTranslation = detectAndTransliterate(
        translation,
        defaultLanguage
      );
      setTranslation(newTranslation);
    }
    setVerse(newVerse);
  }, [defaultLanguage, translation, sloka]);

  useEffect(() => {
    DataAPI.getTranslations().then((translations) => {
      const translationOfVerse = translations.find(
        (t) => t.author_id === 19 && t.verse_id === sloka.verse_order
      );
      setTranslation(translationOfVerse?.description);
    });
    setVerse(sloka);
  }, [sloka]);

  if (showTranslation && !translation) {
    return <ActivityIndicator />;
  }

  return (
    <Card style={styles.cardContainer}>
      {sloka?.id ? (
        <>
          {title && (
            <Text style={styles.cardTitle} variant={"titleMedium"}>
              {title}
            </Text>
          )}
          {showVerseId && (
            <Text style={styles.cardSubtitle} variant={"labelLarge"}>
              Chapter {sloka.chapter_number}, Verse {verse.verse_number}
            </Text>
          )}
          <Text
            style={styles.cardContent}
            variant="bodyMedium"
            controlledFontSize={true}
          >
            {verse.text}
          </Text>
          {showTranslation && (
            <Text style={styles.cardContent} variant="bodyMedium">
              {translation}
            </Text>
          )}
          {onAction && (
            <Button icon={"arrow-right-box"} onPress={onAction}>
              <Text style={{ color: theme.colors.secondary }}>See more</Text>
            </Button>
          )}
        </>
      ) : (
        <ActivityIndicator size={"small"} style={styles.loader} />
      )}
    </Card>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    cardContainer: {
      margin: 20,
      borderRadius: 12,
      backgroundColor: theme.colors.primaryContainer,
      minHeight: 100,
    },
    loader: {
      alignSelf: "center",
      position: "absolute",
      top: "35%",
      left: "48%",
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
      // alignSelf: "center",
      marginTop: 10,
      marginHorizontal: 30,
    },
  });
