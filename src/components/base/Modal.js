import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Portal,
  Modal as PaperModal,
  IconButton,
  Button,
} from "react-native-paper";
import Text from "./Text";

export default function Modal(props) {
  const {
    visible,
    children,
    theme,
    title,
    onClose,
    showFooterActions,
    onSave,
    ...args
  } = props;
  const styles = getStyles(theme);
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  return (
    <Portal>
      <PaperModal
        visible={isVisible}
        {...args}
        onDismiss={() => {
          setIsVisible(false);
          onClose && onClose();
        }}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={{ maxHeight: "100%" }}>
          <Text variant={"titleMedium"} style={styles.modalTitle}>
            {title}
          </Text>
          <IconButton
            icon={"close"}
            iconColor="maroon"
            onPress={() => {
              setIsVisible(false);
              onClose && onClose();
            }}
            style={styles.modalCloseIcon}
          />
          {children}
          {showFooterActions && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
              }}
            >
              <Button
                mode="contained"
                onPress={onSave}
                style={{ width: 130 }}
                buttonColor={theme.colors.primaryContainer}
              >
                <Text variant={"labelMedium"}>Save</Text>
              </Button>
              <Button
                mode="contained"
                onPress={onClose}
                style={{ width: 130 }}
                buttonColor={theme.colors.error}
              >
                <Text
                  variant={"labelMedium"}
                  style={{ color: theme.colors.background }}
                >
                  Cancel
                </Text>
              </Button>
            </View>
          )}
        </View>
      </PaperModal>
    </Portal>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    modalContainer: {
      backgroundColor: theme.colors.surface,
      paddingVertical: 20,
      paddingHorizontal: 10,
      // minWidth: "80%",
      width: 360,
      alignSelf: "center",
      maxHeight: "100%",
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
