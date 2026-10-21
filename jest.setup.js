// Suppress console logs in tests
global.console.error = jest.fn();
global.console.warn = jest.fn();

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { version: "1.2.4" },
    nativeAppVersion: "1.2.4",
  },
}));
