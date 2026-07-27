import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/hooks/use-locale";
import { useSettingsStore } from "@/stores/settings-store";
import { BookOpen, Heart, Home, Settings } from "lucide-react-native";

export default function TabLayout() {
  const { theme } = useTheme();
  const { strings } = useLocale();
  const { developerMode } = useSettingsStore();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[theme].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            paddingTop: 8,
            paddingBottom: 8,
            height: 65,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: strings.navigation.home,
            tabBarIcon: ({ color }) => <Home size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="monitor"
          options={{
            title: strings.navigation.monitor,
            tabBarIcon: ({ color }) => <Heart size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="docs"
          options={{
            title: strings.navigation.docs,
            tabBarIcon: ({ color }) => <BookOpen size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: strings.navigation.settings,
            tabBarIcon: ({ color }) => <Settings size={28} color={color} />,
          }}
        />
      </Tabs>
      {developerMode && (
        <View style={styles.banner}>
          <ThemedText style={styles.bannerText}>DEVELOPER MODE</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#f97316",
  },
  bannerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
});
