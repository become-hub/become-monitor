/**
 * App marketing version shown in UI (footer, settings).
 * Prefer Expo config (`app.config.js` → package.json) so it matches the built binary.
 */

import Constants from "expo-constants";
import packageJson from "../package.json";

export const APP_VERSION: string =
  Constants.expoConfig?.version ??
  Constants.nativeAppVersion ??
  packageJson.version;
