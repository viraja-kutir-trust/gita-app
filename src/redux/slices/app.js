import { createSlice } from "@reduxjs/toolkit";
import { lightTheme } from "../../theme";
import app from "../reducers/app";

export const appSlice = createSlice({
  name: "app",
  initialState: {
    theme: lightTheme,
    selectedVerse: null,
  },
  reducers: app,
});

export const { setTheme, setVerse } = appSlice.actions;

export const selectTheme = (state) => state.app.theme;
export const selectVerse = (state) => state.app.selectedVerse;
