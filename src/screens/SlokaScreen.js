import { Button, Card } from "react-native-paper";
import { StyleSheet } from "react-native";
import Text from "../components/base/Text";

export default function SlokaScreen({ navigation }) {
  return (
    <>
      <Card>
        <Card.Title
          title="Selected Sloka"
          subtitle="Chapter 4, Verse 36"
          titleVariant="titleMedium"
          style={styles.cardTitle}
        />
        <Card.Content>
          <Text variant="bodyMedium">Coming soon...</Text>
          <Button
            icon={"arrow-right-box"}
            onPress={() => {
              navigation.navigate("Home");
            }}
          >
            <Text>Go to home...</Text>
          </Button>
        </Card.Content>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontFamily: "readex-pro",
    color: "blue",
  },
});
