import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useState } from "react";
import { View, TouchableHighlight } from "react-native";
import { BottomNavigation, IconButton } from "react-native-paper";
import Text from "./Text";

const MyBottomNavigation = ({ theme }) => {
  const allRoutes = {
    Home: {
      key: "Home",
      title: "Home",
      focusedIcon: "home",
      unfocusedIcon: "home-outline",
    },
    Select: { key: "Select", title: "Search", focusedIcon: "magnify" },
    Sloka: { key: "Sloka", title: "Verse", focusedIcon: "glasses" },
    Favorites: {
      key: "Favorites",
      title: "Favorites",
      focusedIcon: "star",
      unfocusedIcon: "star-outline",
    },
    Notes: { key: "Notes", title: "Notes", focusedIcon: "lead-pencil" },
  };
  const navigation = useNavigation();
  const route = useRoute();

  return (
    <View
      style={{
        width: "100%",
        height: 70,
        paddingHorizontal: 30,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderTopColor: theme.colors.tertiary,
      }}
    >
      {Object.values(allRoutes).map((each) => (
        <TouchableHighlight
          onPress={() => {
            navigation.navigate(each.key);
          }}
          underlayColor="transparent"
        >
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingBottom: 10,
            }}
          >
            <IconButton
              size={25}
              style={{
                padding: 0,
                backgroundColor:
                  route.name === each.key
                    ? theme.colors.primaryContainer
                    : theme.colors.background,
              }}
              icon={
                route.name === each.key
                  ? each.focusedIcon
                  : each.unfocusedIcon || each.focusedIcon
              }
            />
            <Text style={{ marginTop: -8 }}>{each.title}</Text>
          </View>
        </TouchableHighlight>
      ))}
    </View>
  );
};

export default MyBottomNavigation;
