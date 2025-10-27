import {
  ThemePreference,
  useThemePreference,
} from "@/hooks/use-theme-preference";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme as useDeviceColorScheme } from "react-native";

type ThemeContextType = {
  theme: "light" | "dark";
  themePreference: ThemePreference;
  isSystemTheme: boolean;
  isLoading: boolean;
  updateThemePreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useDeviceColorScheme();
  const { themePreference, effectiveTheme, isLoading, updateThemePreference } =
    useThemePreference();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (!isLoading) {
      setTheme(effectiveTheme);
    }
  }, [effectiveTheme, isLoading]);

  const isSystemTheme = themePreference === "system";

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themePreference,
        isSystemTheme,
        isLoading,
        updateThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
