// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite on web loads a .wasm build of SQLite.
config.resolver.assetExts.push("wasm");
// The prebuilt Gita database (assets/db/gita.db) is bundled as an asset.
config.resolver.assetExts.push("db");

module.exports = config;
