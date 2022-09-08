import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { IconButton, Menu } from "react-native-paper";
import Text from "./Text";

export default function CollapsibleCard(props) {
  const { title, content, theme, menuProps } = props;
  const styles = getStyles(theme);
  const [isOpen, setIsOpen] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  console.log("menu props", menuProps);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <IconButton
          icon={isOpen ? "chevron-up" : "chevron-down"}
          onPress={() => setIsOpen(!isOpen)}
          style={styles.collapseIcon}
        />
        <Text style={styles.cardTitle} variant={"titleMedium"}>
          {title}
        </Text>
        <Menu
          visible={showMenu}
          onDismiss={() => setShowMenu(false)}
          style={{ ...styles.menu, ...menuProps.menuStyle }}
          anchor={
            <IconButton
              icon={"dots-vertical"}
              style={styles.moreIcon}
              onPress={() => setShowMenu(true)}
            />
          }
        >
          {menuProps.menuItems?.map((item) => (
            <Menu.Item
              key={item.title}
              onPress={item.onPress}
              title={item.title}
              style={{ ...styles.menuItem, ...menuProps.menuItemStyle }}
            />
          ))}
        </Menu>
      </View>
      {isOpen && (
        <>
          <Text variant={"bodyMedium"} style={styles.cardContent}>
            {content}
          </Text>
        </>
      )}
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
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
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardTitle: {
      color: theme.colors.onPrimaryContainer,
      marginTop: 10,
      flexGrow: 1,
      maxWidth: "80%",
      textAlign: "center",
    },
    cardContent: {
      marginHorizontal: 10,
      marginTop: 15,
      textAlign: "center",
      maxWidth: "80%",
    },
    collapseIcon: {
      //   position: "absolute",
      //   top: 0,
      //   left: 0,
    },
    moreIcon: {},
    menu: {},
    menuItem: {},
  });
