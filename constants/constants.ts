import { useSettingsStore } from "@/stores/settings-store";

const FALLBACK_PRODUCTION_API_URL = "https://production-api25.become-hub.com";
const FALLBACK_STAGING_API_URL = "https://staging-api25.become-hub.com";

export const API_PRODUCTION_URL =
  process.env.EXPO_PUBLIC_API_PRODUCTION ?? FALLBACK_PRODUCTION_API_URL;
export const API_STAGING_URL =
  process.env.EXPO_PUBLIC_API_STAGING ?? FALLBACK_STAGING_API_URL;

export const getApiBaseUrl = () => {
  const { developerMode } = useSettingsStore.getState();
  return developerMode ? API_STAGING_URL : API_PRODUCTION_URL;
};