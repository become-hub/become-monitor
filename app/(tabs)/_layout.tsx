import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/hooks/use-locale";
import { BookOpen, Heart, Home, Settings } from "lucide-react-native";

export default function TabLayout() {
  const { theme } = useTheme();
  const { strings } = useLocale();

  return (
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
  );
}
