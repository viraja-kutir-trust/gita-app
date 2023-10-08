import { useEffect } from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Divider, IconButton, Menu, Portal } from "react-native-paper";
import DataAPI from "../../gita-data/dataApi";
import { detectAndTransliterate } from "../../utils";
import DropDown from "./DropDown";
import Modal from "./Modal";
import Text from "./Text";

export default function CollapsibleCard(props) {
  const { title, content, theme, menuProps, defaultLanguage, contentLanguage } =
    props;
  const isHindi = contentLanguage === "hindi";
  const styles = getStyles(theme);
  const [isOpen, setIsOpen] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [scriptLanguage, setScriptLanguage] = useState(
    isHindi ? "Devanagari" : defaultLanguage
  );
  const [showScriptChoiceDialog, setShowScriptChoiceDialog] = useState(false);

  useEffect(() => {
    setScriptLanguage(isHindi ? "Devanagari" : defaultLanguage);
  }, [defaultLanguage, isHindi]);

  const handleMenuItemPress = (itemTitle) => {
    setShowMenu(false);
    if (itemTitle === "Change Script") {
      setShowScriptChoiceDialog(true);
    }
  };

  const closeScriptChoiceDialog = () => {
    setShowScriptChoiceDialog(false);
  };

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
          {menuProps.menuItems?.map((item, index) => (
            <View key={title + item.title}>
              <Menu.Item
                onPress={() => {
                  handleMenuItemPress(item.title);
                  item.onPress && item.onPress();
                }}
                disabled={item.disabled}
                title={item.title}
                style={{ ...styles.menuItem, ...menuProps.menuItemStyle }}
              />
              {index < menuProps.menuItems.length - 1 && <Divider />}
            </View>
          ))}
        </Menu>
      </View>
      {isOpen && (
        <Text
          variant={"bodyMedium"}
          style={styles.cardContent}
          controlledFontSize={true}
        >
          {detectAndTransliterate(content, scriptLanguage)}
        </Text>
      )}
      <Portal>
        <Modal
          visible={showScriptChoiceDialog}
          title={"Change Script in Card"}
          onDismiss={() => {
            setScriptLanguage(defaultLanguage);
            closeScriptChoiceDialog();
          }}
          theme={theme}
          showFooterActions
          onSave={closeScriptChoiceDialog}
          onClose={() => {
            setScriptLanguage(defaultLanguage);
            closeScriptChoiceDialog();
          }}
        >
          <DropDown
            header={"Script"}
            description={scriptLanguage}
            options={DataAPI.getTransliterationLanguages().map(
              (language) => language.name
            )}
            onChange={(newLanguage) => {
              setScriptLanguage(newLanguage);
            }}
            theme={theme}
          />
        </Modal>
      </Portal>
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
      width: "100%",
    },
    cardTitle: {
      color: theme.colors.onPrimaryContainer,
      marginTop: 10,
      flexGrow: 1,
      maxWidth: "80%",
      textAlign: "center",
      fontSize: 17,
    },
    cardContent: {
      marginHorizontal: 10,
      marginTop: 15,
      // textAlign: "center",
      maxWidth: "80%",
      // fontSize: 15,
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
