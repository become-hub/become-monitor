import { AppFooter } from "@/components/app-footer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/hooks/use-locale";
import { polarSdk } from "@/features/devices/polar/polar-ble-sdk";
import { useSettingsStore } from "@/stores/settings-store";
import {
  Activity,
  Bluetooth,
  CheckCircle,
  Globe,
  Info,
  Lock,
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
import { APP_VERSION } from "@/constants/app-version";

export default function SettingsScreen() {
  const { theme, themePreference, updateThemePreference } = useTheme();
  const { strings } = useLocale();
  const {
    debugMode,
    setDebugMode,
    developerMode,
    setDeveloperMode,
  } = useSettingsStore();
  const [autoConnect, setAutoConnect] = useState(true);
  const [dataSync, setDataSync] = useState(true);
  const [localDebugMode, setLocalDebugMode] = useState(debugMode);
  const [localDeveloperMode, setLocalDeveloperMode] = useState(developerMode);
  const [password, setPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [pendingMode, setPendingMode] = useState<"debug" | "developer" | null>(
    null
  );
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Check Bluetooth state on mount and update
  useEffect(() => {
    const checkBluetoothState = async () => {
      try {
        const isEnabled = await polarSdk.checkBluetoothState();
        setBluetoothEnabled(isEnabled);
      } catch (error) {
        console.error("Error checking Bluetooth state:", error);
      }
    };

    checkBluetoothState();

    // Listen for Bluetooth state changes
    polarSdk.addEventListener("onBluetoothStateChanged", (state) => {
      setBluetoothEnabled(state.powered);
    });

    return () => {
      polarSdk.removeEventListener("onBluetoothStateChanged");
    };
  }, []);

  // Sincronizza localDebugMode con debugMode quando cambia
  useEffect(() => {
    setLocalDebugMode(debugMode);
  }, [debugMode]);

  useEffect(() => {
    setLocalDeveloperMode(developerMode);
  }, [developerMode]);

  const getCurrentDatePassword = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  };

  const handleDebugModeToggle = (value: boolean) => {
    if (value) {
      setLocalDebugMode(true);
      setPendingMode("debug");
      setShowPasswordInput(true);
    } else {
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
              setPendingMode(null);
              setPassword("");
            },
          },
        ]
      );
    }
  };

  const handleDeveloperModeToggle = (value: boolean) => {
    if (value) {
      setLocalDeveloperMode(true);
      setPendingMode("developer");
      setShowPasswordInput(true);
    } else {
      Alert.alert(
        "Disattiva Developer Mode",
        "Sei sicuro di voler disattivare la modalità developer?",
        [
          {
            text: "Annulla",
            style: "cancel",
          },
          {
            text: "Disattiva",
            onPress: () => {
              setDeveloperMode(false);
              setShowPasswordInput(false);
              setPendingMode(null);
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
      if (pendingMode === "developer") {
        setDeveloperMode(true);
        setLocalDeveloperMode(true);
        setNotification({ type: "success", message: "Developer mode attivato" });
      } else {
        setDebugMode(true);
        setLocalDebugMode(true);
        setNotification({ type: "success", message: "Debug mode attivato" });
      }
      setShowPasswordInput(false);
      setPendingMode(null);
      setPassword("");

      // Auto-close SOLO dopo 5 secondi per il successo
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    } else {
      setPassword("");
      if (pendingMode === "developer") {
        setLocalDeveloperMode(false);
      } else {
        setLocalDebugMode(false);
      }
      setPendingMode(null);

      // Mostra notifica di errore (NON si chiude automaticamente)
      setNotification({ type: "error", message: "Password non corretta" });
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordInput(false);
    setPassword("");
    if (pendingMode === "developer") {
      setLocalDeveloperMode(false);
    } else {
      setLocalDebugMode(false);
    }
    setPendingMode(null);
  };

  const handleBluetoothToggle = async (value: boolean) => {
    // Solo attivazione: se cercano di spegnere, ignora
    if (!value) return;
    try {
      const hasPermissions = await polarSdk.hasBluetoothPermissions();
      if (!hasPermissions) {
        await polarSdk.requestBluetoothPermissions();
        await new Promise((r) => setTimeout(r, 500));
        const finalCheck = await polarSdk.hasBluetoothPermissions();
        if (!finalCheck) return;
      }
      const requested = await polarSdk.requestEnableBluetooth();
      if (requested) {
        await new Promise((r) => setTimeout(r, 800));
        const current = await polarSdk.checkBluetoothState();
        setBluetoothEnabled(current);
        if (current)
          setNotification({ type: "success", message: "Bluetooth attivato" });
        setTimeout(() => setNotification(null), 2500);
      }
    } catch {
      // silenzioso: niente disattivazione supportata
    }
  };

  const handleAbout = () => {
    Alert.alert(
      "About Augmented Monitor",
      `Version ${APP_VERSION}\n\nProfessional HRV monitoring solution for athletes and health professionals.\n\n© 2025 Become Hub`,
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
            {strings.settings.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Configura la tua esperienza di monitoraggio
          </ThemedText>
        </ThemedView>

        {/* Language Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.settings.language}
          </ThemedText>

          <ThemedView style={styles.settingItem}>
            <View style={styles.settingContent}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Globe size={18} color={Colors[theme].tint} />
                <ThemedText style={styles.settingLabel}>
                  {strings.settings.selectLanguage}
                </ThemedText>
              </View>
              <ThemedText style={styles.settingDescription}>
                {strings.settings.languageDescription}
              </ThemedText>
            </View>
            <View style={styles.languageSelector}>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  { borderColor: Colors[theme].tint },
                ]}
              >
                <ThemedText style={styles.languageOptionText}>
                  🇮🇹 Italiano
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </ThemedView>

        {/* Connection Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Connessione
          </ThemedText>

          <ThemedView style={styles.settingItem}>
            <View style={styles.settingContent}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Bluetooth
                  size={18}
                  color={bluetoothEnabled ? Colors[theme].tint : "#999"}
                />
                <ThemedText style={styles.settingLabel}>Bluetooth</ThemedText>
              </View>
              <ThemedText style={styles.settingDescription}>
                {bluetoothEnabled
                  ? "Bluetooth è attivo (usa Impostazioni per disattivare)"
                  : "Bluetooth è disattivo"}
              </ThemedText>
            </View>
            <Switch
              value={bluetoothEnabled}
              disabled={bluetoothEnabled}
              onValueChange={(next) => {
                if (next) {
                  handleBluetoothToggle(true);
                }
              }}
              trackColor={{
                false: "#767577",
                true: Colors[theme].tint,
              }}
              thumbColor={bluetoothEnabled ? "#fff" : "#f4f3f4"}
            />
          </ThemedView>

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

        {/* HRV analysis mode */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.settings.hrvMode}
          </ThemedText>

          <ThemedView
            style={[
              styles.liveRateCard,
              { borderColor: Colors[theme].border },
            ]}
          >
            <View style={styles.liveRateHeader}>
              <View
                style={[
                  styles.liveRateIconWrap,
                  {
                    backgroundColor:
                      theme === "dark"
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(10,126,164,0.1)",
                  },
                ]}
              >
                <Activity size={18} color={Colors[theme].tint} />
              </View>
              <ThemedText style={[styles.settingDescription, { flex: 1 }]}>
                {strings.settings.hrvModeDescription}
              </ThemedText>
            </View>

            <View
              style={[
                styles.liveRateSegmentTrack,
                {
                  backgroundColor:
                    theme === "dark"
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.04)",
                },
              ]}
            >
              <View
                style={[
                  styles.liveRateSegment,
                  styles.liveRateSegmentSelected,
                  {
                    backgroundColor:
                      theme === "dark" ? "#1f2933" : "#ffffff",
                    borderColor: Colors[theme].tint,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: true }}
                accessibilityLabel={strings.settings.hrvModeLive}
              >
                <ThemedText
                  style={[
                    styles.hrvModeTitle,
                    { color: Colors[theme].tint },
                  ]}
                >
                  {strings.settings.hrvModeLive}
                </ThemedText>
                <ThemedText style={styles.liveRateHint}>
                  {strings.settings.hrvModeLiveHint}
                </ThemedText>
              </View>

              <View
                style={[styles.liveRateSegment, styles.hrvModeSegmentDisabled]}
                accessibilityState={{ disabled: true }}
                accessibilityLabel={`${strings.settings.hrvModeExtended}, ${strings.settings.hrvModeExtendedUnavailable}`}
              >
                <View style={styles.hrvModeUnavailableBadge}>
                  <Lock size={11} color={Colors[theme].icon} />
                  <ThemedText style={styles.hrvModeUnavailableText}>
                    {strings.settings.hrvModeExtendedUnavailable}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[styles.hrvModeTitle, styles.hrvModeTitleMuted]}
                >
                  {strings.settings.hrvModeExtended}
                </ThemedText>
                <ThemedText style={[styles.liveRateHint, styles.hrvModeTitleMuted]}>
                  {strings.settings.hrvModeExtendedHint}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.hrvModeFootnote}>
              {strings.settings.hrvModeFootnote}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Theme Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.settings.theme}
          </ThemedText>
          <ThemedText style={styles.currentThemeText}>
            Tema attuale: {theme === "light" ? "Chiaro" : "Scuro"}{" "}
            {themePreference === "system" ? "(sistema)" : ""}
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
                  {strings.settings.light}
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
                  {strings.settings.dark}
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
                  {strings.settings.system}
                </ThemedText>
              </View>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>

        {/* Advanced Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Avanzate
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

          <ThemedView style={styles.settingItem}>
            <View style={styles.settingContent}>
              <ThemedText style={styles.settingLabel}>Developer Mode</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Route API calls to staging environment
              </ThemedText>
            </View>
            <Switch
              value={localDeveloperMode}
              onValueChange={handleDeveloperModeToggle}
              trackColor={{
                false: "#767577",
                true: Colors[theme].tint,
              }}
              thumbColor={localDeveloperMode ? "#fff" : "#f4f3f4"}
            />
          </ThemedView>

          {/* Password Input per Debug Mode */}
          {showPasswordInput && (
            <ThemedView style={styles.passwordContainer}>
              <ThemedText style={styles.passwordLabel}>
                Inserisci la password per attivare{" "}
                {pendingMode === "developer" ? "il developer mode" : "il debug mode"}
                :
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
            {strings.settings.about}
          </ThemedText>

          <ThemedView style={styles.infoCard}>
            <ThemedText style={styles.infoLabel}>Version</ThemedText>
            <ThemedText style={styles.infoValue}>
              {APP_VERSION}
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
  liveRateCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  liveRateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  liveRateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  liveRateSegmentTrack: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  liveRateSegment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    minHeight: 96,
  },
  liveRateSegmentSelected: {
    shadowColor: "#0a7ea4",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  liveRateHint: {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 8,
    textAlign: "center",
  },
  hrvModeTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  hrvModeFootnote: {
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 17,
  },
  hrvModeSegmentDisabled: {
    opacity: 0.55,
  },
  hrvModeTitleMuted: {
    opacity: 0.75,
  },
  hrvModeUnavailableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(127,127,127,0.16)",
    marginBottom: 6,
  },
  hrvModeUnavailableText: {
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.85,
    textAlign: "center",
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
  languageSelector: {
    flexDirection: "row",
    gap: 8,
  },
  languageOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  languageOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
