import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Portal, Modal as PaperModal, IconButton } from "react-native-paper";
import Text from "./Text";

export default function Modal(props) {
  const { visible, children, theme, title, onClose, ...args } = props;
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
      maxHeight: "95%",
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
