import { createSlice } from "@reduxjs/toolkit";
import { lightTheme } from "../../theme";
import app from "../reducers/app";

export const appSlice = createSlice({
  name: "app",
  initialState: {
    theme: lightTheme,
  },
  reducers: app,
});

export const { setTheme } = appSlice.actions;

export const selectTheme = (state) => state.app.theme;
