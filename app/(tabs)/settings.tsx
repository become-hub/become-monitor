import { AppFooter } from "@/components/app-footer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettingsStore } from "@/stores/settings-store";
import {
  CheckCircle,
  Info,
  Monitor,
  Moon,
  Sun,
  XCircle,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import packageJson from "../../package.json";

export default function SettingsScreen() {
  const { theme, themePreference, updateThemePreference } = useTheme();
  const { debugMode, setDebugMode } = useSettingsStore();
  const [autoConnect, setAutoConnect] = useState(true);
  const [dataSync, setDataSync] = useState(true);
  const [localDebugMode, setLocalDebugMode] = useState(debugMode);
  const [password, setPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Sincronizza localDebugMode con debugMode quando cambia
  useEffect(() => {
    setLocalDebugMode(debugMode);
  }, [debugMode]);

  const getCurrentDatePassword = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  };

  const handleDebugModeToggle = (value: boolean) => {
    if (value) {
      // Se stanno attivando il debug mode, mostra il campo password
      setLocalDebugMode(true); // Imposta lo switch a "on" temporaneamente
      setShowPasswordInput(true);
    } else {
      // Se stanno disattivando, chiedi conferma
      Alert.alert(
        "Disattiva Debug Mode",
        "Sei sicuro di voler disattivare la modalità debug?",
        [
          {
            text: "Annulla",
            style: "cancel",
          },
          {
            text: "Disattiva",
            onPress: () => {
              setDebugMode(false);
              setShowPasswordInput(false);
              setPassword("");
            },
          },
        ]
      );
    }
  };

  const handlePasswordSubmit = () => {
    const correctPassword = getCurrentDatePassword();
    if (password === correctPassword) {
      setDebugMode(true);
      setLocalDebugMode(true);
      setShowPasswordInput(false);
      setPassword("");

      // Mostra notifica di successo
      setNotification({ type: "success", message: "Debug mode attivato" });

      // Auto-close SOLO dopo 5 secondi per il successo
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    } else {
      setPassword("");
      setLocalDebugMode(false); // Ripristina lo switch

      // Mostra notifica di errore (NON si chiude automaticamente)
      setNotification({ type: "error", message: "Password non corretta" });
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordInput(false);
    setPassword("");
    setLocalDebugMode(false); // Ripristina lo switch
  };

  const handleAbout = () => {
    Alert.alert(
      "About Become Monitor",
      `Version ${packageJson.version}\n\nProfessional HRV monitoring solution for athletes and health professionals.\n\n© 2025 Become Hub`,
      [{ text: "OK" }]
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Notifica */}
      {notification && (
        <View
          style={[
            styles.notification,
            notification.type === "success"
              ? styles.notificationSuccess
              : styles.notificationError,
          ]}
        >
          {notification.type === "success" ? (
            <CheckCircle size={24} color="#fff" />
          ) : (
            <XCircle size={24} color="#fff" />
          )}
          <ThemedText style={styles.notificationText}>
            {notification.message}
          </ThemedText>
          {/* Pulsante di chiusura per tutte le notifiche */}
          <TouchableOpacity
            onPress={() => setNotification(null)}
            style={styles.notificationCloseButton}
          >
            <XCircle size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

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
              value={localDebugMode}
              onValueChange={handleDebugModeToggle}
              trackColor={{
                false: "#767577",
                true: Colors[theme].tint,
              }}
              thumbColor={localDebugMode ? "#fff" : "#f4f3f4"}
            />
          </ThemedView>

          {/* Password Input per Debug Mode */}
          {showPasswordInput && (
            <ThemedView style={styles.passwordContainer}>
              <ThemedText style={styles.passwordLabel}>
                Inserisci la password per attivare il debug mode:
              </ThemedText>
              <TextInput
                style={[
                  styles.passwordInput,
                  {
                    borderColor: Colors[theme].tint,
                    color: theme === "dark" ? "#fff" : "#000",
                  },
                ]}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={theme === "dark" ? "#999" : "#666"}
                secureTextEntry
                autoFocus
              />
              <View style={styles.passwordButtons}>
                <TouchableOpacity
                  style={[styles.passwordButton, styles.cancelButton]}
                  onPress={handlePasswordCancel}
                >
                  <ThemedText style={styles.passwordButtonText}>
                    Annulla
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.passwordButton,
                    { backgroundColor: Colors[theme].tint },
                  ]}
                  onPress={handlePasswordSubmit}
                >
                  <ThemedText
                    style={[styles.passwordButtonText, { color: "#fff" }]}
                  >
                    Conferma
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          )}
        </ThemedView>

        {/* App Information */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            App Information
          </ThemedText>

          <ThemedView style={styles.infoCard}>
            <ThemedText style={styles.infoLabel}>Version</ThemedText>
            <ThemedText style={styles.infoValue}>
              {packageJson.version}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.infoCard}>
            <ThemedText style={styles.infoLabel}>Build</ThemedText>
            <ThemedText style={styles.infoValue}>
              {new Date().toISOString().slice(0, 10).replace(/-/g, "")}
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
        <AppFooter />
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
  passwordContainer: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  passwordButtons: {
    flexDirection: "row",
    gap: 12,
  },
  passwordButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
  },
  passwordButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  notification: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationSuccess: {
    backgroundColor: "#10B981", // Verde
  },
  notificationError: {
    backgroundColor: "#EF4444", // Rosso
  },
  notificationText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
    flex: 1,
  },
  notificationCloseButton: {
    padding: 4,
    marginLeft: 8,
  },
});
