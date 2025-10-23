import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Download,
  Info,
  Monitor,
  Moon,
  Sun,
  Trash2,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsScreen() {
  const { theme, themePreference, updateThemePreference } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoConnect, setAutoConnect] = useState(true);
  const [dataSync, setDataSync] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

  const handleClearData = () => {
    Alert.alert(
      "Clear All Data",
      "This will remove all stored authentication data and device connections. Are you sure?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            // TODO: Implement data clearing
            Alert.alert("Success", "All data has been cleared.");
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      "Export Data",
      "Export your monitoring data for analysis or backup.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Export",
          onPress: () => {
            // TODO: Implement data export
            Alert.alert("Success", "Data export started.");
          },
        },
      ]
    );
  };

  const handleAbout = () => {
    Alert.alert(
      "About Become Monitor",
      "Version 1.0.0\n\nProfessional HRV monitoring solution for athletes and health professionals.\n\n© 2024 Become Hub",
      [{ text: "OK" }]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Settings
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Configure your monitoring experience
          </ThemedText>
        </ThemedView>

        {/* Connection Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Connection
          </ThemedText>

          <ThemedView style={styles.settingItem}>
            <View style={styles.settingContent}>
              <ThemedText style={styles.settingLabel}>Auto-Connect</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Automatically connect to saved devices
              </ThemedText>
            </View>
            <Switch
              value={autoConnect}
              onValueChange={setAutoConnect}
              trackColor={{
                false: "#767577",
                true: Colors[theme].tint,
              }}
              thumbColor={autoConnect ? "#fff" : "#f4f3f4"}
            />
          </ThemedView>

          <ThemedView style={styles.settingItem}>
            <View style={styles.settingContent}>
              <ThemedText style={styles.settingLabel}>Data Sync</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Sync data to Become Hub cloud
              </ThemedText>
            </View>
            <Switch
              value={dataSync}
              onValueChange={setDataSync}
              trackColor={{
                false: "#767577",
                true: Colors[theme].tint,
              }}
              thumbColor={dataSync ? "#fff" : "#f4f3f4"}
            />
          </ThemedView>
        </ThemedView>

        {/* Theme Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Appearance
          </ThemedText>
          <ThemedText style={styles.currentThemeText}>
            Current theme: {theme}{" "}
            {themePreference === "system" ? "(system)" : ""}
          </ThemedText>

          <ThemedView style={styles.themeOptions}>
            <TouchableOpacity
              style={[
                styles.themeOption,
                themePreference === "light" && styles.themeOptionSelected,
                { borderColor: Colors[theme].tint },
              ]}
              onPress={() => updateThemePreference("light")}
            >
              <View style={styles.themeOptionContent}>
                <Sun
                  size={20}
                  color={
                    themePreference === "light" ? Colors[theme].tint : "#666"
                  }
                />
                <ThemedText
                  style={[
                    styles.themeOptionText,
                    themePreference === "light" &&
                      styles.themeOptionTextSelected,
                  ]}
                >
                  Light
                </ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themePreference === "dark" && styles.themeOptionSelected,
                { borderColor: Colors[theme].tint },
              ]}
              onPress={() => updateThemePreference("dark")}
            >
              <View style={styles.themeOptionContent}>
                <Moon
                  size={20}
                  color={
                    themePreference === "dark" ? Colors[theme].tint : "#666"
                  }
                />
                <ThemedText
                  style={[
                    styles.themeOptionText,
                    themePreference === "dark" &&
                      styles.themeOptionTextSelected,
                  ]}
                >
                  Dark
                </ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themePreference === "system" && styles.themeOptionSelected,
                { borderColor: Colors[theme].tint },
              ]}
              onPress={() => updateThemePreference("system")}
            >
              <View style={styles.themeOptionContent}>
                <Monitor
                  size={20}
                  color={
                    themePreference === "system" ? Colors[theme].tint : "#666"
                  }
                />
                <ThemedText
                  style={[
                    styles.themeOptionText,
                    themePreference === "system" &&
                      styles.themeOptionTextSelected,
                  ]}
                >
                  System
                </ThemedText>
              </View>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>

        {/* Notification Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Notifications
          </ThemedText>

          <ThemedView style={styles.settingItem}>
            <View style={styles.settingContent}>
              <ThemedText style={styles.settingLabel}>
                Push Notifications
              </ThemedText>
              <ThemedText style={styles.settingDescription}>
                Receive alerts for connection status
              </ThemedText>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{
                false: "#767577",
                true: Colors[theme].tint,
              }}
              thumbColor={notificationsEnabled ? "#fff" : "#f4f3f4"}
            />
          </ThemedView>
        </ThemedView>

        {/* Advanced Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Advanced
          </ThemedText>

          <ThemedView style={styles.settingItem}>
            <View style={styles.settingContent}>
              <ThemedText style={styles.settingLabel}>Debug Mode</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Enable detailed logging and diagnostics
              </ThemedText>
            </View>
            <Switch
              value={debugMode}
              onValueChange={setDebugMode}
              trackColor={{
                false: "#767577",
                true: Colors[theme].tint,
              }}
              thumbColor={debugMode ? "#fff" : "#f4f3f4"}
            />
          </ThemedView>
        </ThemedView>

        {/* Data Management */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Data Management
          </ThemedText>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: Colors[theme].tint }]}
            onPress={handleExportData}
          >
            <View style={styles.actionButtonContent}>
              <Download size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.actionButtonText}>
                Export Data
              </ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: "#FF9800" }]}
            onPress={handleClearData}
          >
            <View style={styles.actionButtonContent}>
              <Trash2 size={20} color="#FF9800" />
              <ThemedText
                style={[styles.actionButtonText, { color: "#FF9800" }]}
              >
                Clear All Data
              </ThemedText>
            </View>
          </TouchableOpacity>
        </ThemedView>

        {/* App Information */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            App Information
          </ThemedText>

          <ThemedView style={styles.infoCard}>
            <ThemedText style={styles.infoLabel}>Version</ThemedText>
            <ThemedText style={styles.infoValue}>1.0.0</ThemedText>
          </ThemedView>

          <ThemedView style={styles.infoCard}>
            <ThemedText style={styles.infoLabel}>Build</ThemedText>
            <ThemedText style={styles.infoValue}>2024.01.001</ThemedText>
          </ThemedView>

          <ThemedView style={styles.infoCard}>
            <ThemedText style={styles.infoLabel}>Platform</ThemedText>
            <ThemedText style={styles.infoValue}>
              React Native + Expo
            </ThemedText>
          </ThemedView>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: Colors[theme].tint }]}
            onPress={handleAbout}
          >
            <View style={styles.actionButtonContent}>
              <Info size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.actionButtonText}>About</ThemedText>
            </View>
          </TouchableOpacity>
        </ThemedView>

        {/* Footer */}
        <ThemedView style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Become Monitor{"\n"}
            Professional HRV Monitoring
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  section: {
    padding: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  infoCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    opacity: 0.7,
  },
  footer: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: "center",
  },
  themeOptions: {
    flexDirection: "row",
    gap: 12,
  },
  themeOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  themeOptionSelected: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  themeOptionContent: {
    alignItems: "center",
    gap: 8,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  themeOptionTextSelected: {
    fontWeight: "600",
  },
  currentThemeText: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
    fontStyle: "italic",
  },
});
