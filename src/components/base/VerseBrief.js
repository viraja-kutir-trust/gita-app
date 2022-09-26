import { useState } from "react";
import { TouchableHighlight, View } from "react-native";
import { Divider, IconButton, Menu } from "react-native-paper";
import { detectAndTransliterate } from "../../utils";
import Text from "./Text";

export default function VerseBrief(props) {
  const { verse, actions, theme, style, onPress, defaultLanguage } = props;
  const styles = getStyles(theme);
  const [showMenu, setShowMenu] = useState(false);

  console.log("Default L: ", defaultLanguage);

  return (
    <TouchableHighlight
      onPress={onPress}
      style={{ ...styles.touchableHighlight, ...style.container }}
    >
      <View style={styles.container}>
        <Text style={styles.content} numberOfLines={1}>{`${
          verse.chapter_number
        }:${verse.verse_number} - ${detectAndTransliterate(
          verse.text,
          defaultLanguage
        )}`}</Text>
        <Menu
          visible={showMenu}
          onDismiss={() => {
            setShowMenu(false);
          }}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={() => {
                setShowMenu(true);
              }}
            />
          }
        >
          {actions.map((action, index) => (
            <View key={verse.id + action.title}>
              <Menu.Item
                title={action.title}
                onPress={() => {
                  action.onPress && action.onPress();
                  setShowMenu(false);
                }}
              />
              {index < actions.length - 1 && <Divider />}
            </View>
          ))}
        </Menu>
      </View>
    </TouchableHighlight>
  );
}

const getStyles = (theme) => ({
  touchableHighlight: {
    width: "95%",
    borderRadius: 12,
  },
  container: {
    backgroundColor: theme.colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: 5,
    paddingLeft: 15,
    minHeight: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // width: "95%",
  },
  content: { maxWidth: "85%" },
  actions: {},
});
