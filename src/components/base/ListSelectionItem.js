import { useState } from "react";
import { StyleSheet, View, TouchableHighlight } from "react-native";
import Text from "./Text";
import CheckIcon from "react-native-vector-icons/FontAwesome";
export default function ListSelectionItem(props) {
  const { text, theme, onPress, defaultSelected } = props;
  const styles = getStyles(theme);
  const [selected, setSelected] = useState(defaultSelected);

  const handlePress = () => {
    console.log("pressed ", selected);
    setSelected(!selected);
    onPress && onPress(!selected);
  };

  return (
    <TouchableHighlight onPress={handlePress} style={{ borderRadius: 12 }}>
      <View
        style={{
          ...styles.container,
          backgroundColor: selected
            ? theme.colors.primaryContainer
            : theme.colors.secondaryContainer,
        }}
      >
        <CheckIcon
          name={selected ? "check-circle" : "check"}
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <Text>{text}</Text>
        </View>
      </View>
    </TouchableHighlight>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      minHeight: 50,
      backgroundColor: theme.colors.secondaryContainer,
      flexDirection: "row",
      borderRadius: 12,
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    textContainer: {
      maxWidth: "90%",
    },
    text: {},
    icon: {
      color: theme.colors.tertiary,
      marginRight: 10,
    },
  });
