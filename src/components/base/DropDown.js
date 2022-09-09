import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Divider, IconButton, Menu } from "react-native-paper";
import Text from "./Text";

export default function DropDown(props) {
  const { header, description, onLayout, onPress, theme, onChange, options } =
    props;
  const styles = getStyles(theme);
  const [showMenu, setShowMenu] = useState(false);
  const [layout, setLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  return (
    <>
      <Menu
        visible={showMenu}
        onDismiss={() => setShowMenu(false)}
        anchor={
          <TouchableOpacity
            style={styles.selectionContainer}
            onPress={() => {
              setShowMenu(true);
              onPress && onPress();
            }}
            onLayout={(event) => {
              let { x, y, width, height, left, top } = event.nativeEvent.layout;
              console.log("layout", event.nativeEvent.layout);
              if (x !== left) {
                x = left;
              }
              if (y !== top) {
                y = top;
              }
              setLayout({ x, y, width, height });
              onLayout && onLayout(event);
            }}
          >
            <View style={styles.selectionParent}>
              <View style={styles.selectionTextParent}>
                <Text numberOfLines={1} variant={"titleMedium"}>
                  {header}
                </Text>
                <Text numberOfLines={1} variant={"labelMedium"}>
                  {description}
                </Text>
              </View>
              <IconButton
                icon={"arrow-down-drop-circle"}
                onClick={() => {
                  setShowMenu(true);
                }}
              />
            </View>
          </TouchableOpacity>
        }
        style={{
          ...styles.selectionMenuContainer,
          width: layout.width || "auto",
        }}
        contentStyle={{
          borderRadius: 12,
          fontFamily: "readex-pro",
          margin: 20,
          width: "100%",
        }}
      >
        {options.map((item, index) => (
          <View key={item}>
            <Menu.Item
              key={item.id}
              onPress={() => {
                onChange(item);
                setShowMenu(false);
              }}
              title={item}
              style={{ width: "100%", minWidth: "100%", maxWidth: "100%" }}
              contentStyle={styles.selectionText}
              titleStyle={styles.selectionText}
            />
            {index !== item.length - 1 && <Divider id={item} />}
          </View>
        ))}
      </Menu>
    </>
  );
}
const getStyles = (theme) =>
  StyleSheet.create({
    selectionContainer: {
      borderRadius: 12,
      margin: 20,
      padding: 8,
      height: 65,
      backgroundColor: theme?.colors?.tertiaryContainer,
      flexDirection: "row",
      alignItems: "center",
    },
    selectionParent: {
      justifyContent: "space-between",
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      //   height: 40,
      marginLeft: 10,
    },
    selectionTextParent: {
      justifyContent: "space-between",
      flex: 1,
      height: 40,
    },
    selectionMenuContainer: {
      //   marginTop: 12,
      //   marginLeft: 13,
      borderRadius: 12,
    },
    selectionText: {
      fontFamily: "readex-pro",
      width: "100%",
      minWidth: "100%",
      maxWidth: "100%",
    },
  });
