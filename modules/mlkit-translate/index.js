import { requireOptionalNativeModule } from "expo";

/**
 * On-device translation with Google ML Kit (local Expo module, see ios/ and android/).
 * Null in Expo Go, on web, or in a build made before the module was added.
 */
const Native = requireOptionalNativeModule("MlkitTranslate");

export const translationAvailable = !!Native;

/** Translate several strings with one translator; downloads missing models of the pair first. */
export function translateTexts(texts, from, to) {
  if (!Native) return Promise.reject(new Error("On-device translation isn't available in this build"));
  return Native.translate(texts, from, to);
}

/** ML Kit codes of the language models already on the device (e.g. ["en", "hi"]). */
export async function downloadedModels() {
  if (!Native) return [];
  try {
    return await Native.downloadedModels();
  } catch (e) {
    return [];
  }
}

export function deleteModel(code) {
  if (!Native) return Promise.resolve(false);
  return Native.deleteModel(code);
}
