# gita-app
A platform neutral all-in-one Bhagavad-Gita App based on React-Native and Material You theme

To setup, clone the project, ensure to install `Node` first and then run `npm install`, `npm start` in the project directory.

## Desktop app (macOS and Windows) and web app

The desktop app has its own UI, built for large screens: `webapp/` (Vite +
React, plain HTML/CSS). It has every reading feature of the phone app —
Today, chapters, verses with clickable sloka words and padaccheda, word study
with grammar, translations and their comparison, the commentary reader with
find-in-text, highlights, notes, bookmarks, search, chant mode and settings,
plus a Reading mode (the whole Gita as one continuous page, with the sloka,
padaccheda, word-by-word and translation each switchable; the sidebar's
chapters open it at the chapter's first verse) —
laid out for a mouse and keyboard: a sidebar with the chapters, a study panel
next to the verse, a ⌘K palette and shortcuts (← → verses, B bookmark,
N note, ⌘F find in a commentary, ⌘, settings, ⌘\ sidebar).

The phone app (`src/`) is untouched by it. Both share the data logic:
`src/gita-data/api.js` (all database queries and search), `src/lib/names.js`,
`texts.js`, `lines.js` and `wordMeanings.js` (word-by-word sources, sandhi
word taps). Everything on screen in `webapp/` is its own.

Electron (`electron/`) wraps the webapp and works fully offline:

- `electron/main.js` serves the built webapp from an `app://gita` origin and
  reads `gita.db` (shipped in the app's Resources) with Electron's built-in
  `node:sqlite` — it has FTS5 and the trigram tokenizer, and needs no native
  module, so macOS and Windows installers can both be built on a Mac.
- `electron/preload.js` exposes `window.gitaDesktop` (`db.all/first`, `share`).
- Notes, bookmarks, highlights and settings live in the app's local storage
  under the phone app's key (`persist:gita-v3`), so they survive restarts and
  updates.

In a plain browser the webapp opens the same database with SQLite's official
wasm build (also with FTS5) in a worker, so `npm run webapp:build` gives a
hostable static site with search (`webapp/dist`, which includes the 57 MB
`gita.db`).

Use Node 22 (`nvm use`). Then:

```bash
npm run desktop:install   # once: webapp + Electron dependencies
npm run webapp            # dev: the UI on http://localhost:5173 (works in a browser too)
npm run desktop:dev       # dev: an Electron window on that dev server
npm run desktop:mac       # build webapp + electron/dist/*.dmg (arm64 and x64)
npm run desktop:win       # build webapp + electron/dist/*-Setup-*.exe (NSIS, x64)
```

`webapp/dist`, `electron/web/` and `electron/dist/` are build outputs and are
git-ignored. Each installer is about 130–145 MB.

**Signing (macOS).** `npm run desktop:mac` signs the app with the Developer ID
Application certificate in your keychain (hardened runtime). To notarize, store
your Apple credentials once (`xcrun notarytool store-credentials gita-notary
--apple-id … --team-id J4G4MSXC9Q`, which asks for an app-specific password),
then for each DMG:

```bash
codesign --sign "Developer ID Application: Sai Teja Vadlapatla (J4G4MSXC9Q)" --timestamp electron/dist/<file>.dmg
xcrun notarytool submit electron/dist/<file>.dmg --keychain-profile gita-notary --wait
xcrun stapler staple electron/dist/<file>.dmg
```

`npm --prefix electron run dist:mac:unsigned` builds without signing. The
Windows installer is unsigned (SmartScreen warns); sign it with a code-signing
certificate for distribution.

What's different or missing on desktop:

- **On-device translation** (ML Kit, `modules/mlkit-translate`) is phone-only
  and isn't offered.
- **Share** opens the macOS share menu; on Windows the text is copied to the
  clipboard with a short notice. Copy is everywhere.
- **Haptics** don't apply. **Keep screen awake** in chant mode uses the
  browser's wake lock.
- **Audio recitation** is off in every build (`AUDIO_ENABLED` in
  `src/lib/features.js`); the desktop UI has no player yet.
- The first-run tour isn't shown; Settings and the ⌘K palette list the
  shortcuts instead.

The Expo web build of the phone UI (`npm run web`) still works: in a browser it
loads the database into memory (expo-sqlite's OPFS store allowed only one tab,
and a failed import left an empty file behind — "no such table: verses"), but
its wasm SQLite has no FTS5, so search needs the webapp or the desktop app.
