import { useState } from "react";
import { Appbar, IconButton, Menu } from "react-native-paper";
import { useDispatch } from "react-redux";
import { setTheme } from "../../redux/slices/app";
import { darkTheme, lightTheme } from "../../theme";

export default function ScreenHeader(props) {
  const { navigation, title, theme } = props;
  const dispatch = useDispatch();
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);

  return (
    <Appbar.Header>
      <Appbar.BackAction size={20} onPress={() => navigation.goBack()} />
      <Appbar.Content titleStyle={{ fontSize: 18 }} title={title} />
      {/* <Appbar.Action> */}
      <Menu
        visible={headerMenuAnchor}
        onDismiss={() => {
          setHeaderMenuAnchor(null);
        }}
        anchor={
          <IconButton
            onPress={() => setHeaderMenuAnchor(true)}
            icon="dots-vertical"
          ></IconButton>
        }
      >
        <Menu.Item
          onPress={() => {
            dispatch(setTheme(theme.dark ? lightTheme : darkTheme));
            setHeaderMenuAnchor(null);
          }}
          title="Toggle Theme"
        />
        {/* <Divider />
          <Menu.Item onPress={() => {}} title="Item 2" />
          <Divider />
          <Menu.Item onPress={() => {}} title="Item 3" /> */}
      </Menu>
      {/* </Appbar.Action> */}
    </Appbar.Header>
  );
}
