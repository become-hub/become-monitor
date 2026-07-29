/**
 * Monitor Status Section Component
 * Displays Bluetooth, device, streaming, auth status
 */

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { View } from "react-native";
import { monitorStyles } from "./monitor-styles";

interface MonitorStatusSectionProps {
  bluetoothStateText: string;
  deviceStatusText: string;
  streamingStatusText: string;
  deviceCode: string;
  userId: number;
  appId: string;
  offlineRecordingStarted: boolean;
  connectedDeviceId: string | null;
  showRawEcgCards: boolean;
  authToken: string;
  authCode: string;
}

export function MonitorStatusSection({
  bluetoothStateText,
  deviceStatusText,
  streamingStatusText,
  deviceCode,
  userId,
  appId,
  offlineRecordingStarted,
  connectedDeviceId,
  showRawEcgCards,
  authToken,
  authCode,
}: MonitorStatusSectionProps) {
  return (
    <ThemedView style={monitorStyles.statusSection}>
      <View style={monitorStyles.statusRow}>
        <ThemedText style={monitorStyles.statusLabel}>Bluetooth:</ThemedText>
        <ThemedText style={monitorStyles.statusValue}>
          {bluetoothStateText}
        </ThemedText>
      </View>
      <View style={monitorStyles.statusRow}>
        <ThemedText style={monitorStyles.statusLabel}>Device connesso:</ThemedText>
        <ThemedText style={monitorStyles.statusValue}>
          {deviceStatusText}
        </ThemedText>
      </View>
      <View style={monitorStyles.statusRow}>
        <ThemedText style={monitorStyles.statusLabel}>Streaming:</ThemedText>
        <ThemedText style={monitorStyles.statusValue}>
          {streamingStatusText}
        </ThemedText>
      </View>
      <View style={monitorStyles.statusRow}>
        <ThemedText style={monitorStyles.statusLabel}>Device Code:</ThemedText>
        <ThemedText style={monitorStyles.statusValue}>
          {deviceCode || "N/A"}
        </ThemedText>
      </View>
      <View style={monitorStyles.statusRow}>
        <ThemedText style={monitorStyles.statusLabel}>User ID:</ThemedText>
        <ThemedText style={monitorStyles.statusValue}>
          {userId || "N/A"}
        </ThemedText>
      </View>
      <View style={monitorStyles.statusRow}>
        <ThemedText style={monitorStyles.statusLabel}>App ID:</ThemedText>
        <ThemedText style={monitorStyles.statusValue}>{appId || "N/A"}</ThemedText>
      </View>
      <View style={monitorStyles.statusRow}>
        <ThemedText style={monitorStyles.statusLabel}>Offline track:</ThemedText>
        <ThemedText style={monitorStyles.statusValue}>
          {offlineRecordingStarted
            ? "🟢 Polar PPI"
            : connectedDeviceId
            ? showRawEcgCards
              ? "🟠 Buffer live (ECG RR)"
              : "🟠 Buffer live"
            : "🔴 Off"}
        </ThemedText>
      </View>
      {!authToken && connectedDeviceId && authCode && (
        <View style={monitorStyles.authCodeContainer}>
          <ThemedText style={monitorStyles.authCodeLabel}>
            Inserisci questo codice sul PC:
          </ThemedText>
          <ThemedText style={monitorStyles.authCode}>{authCode}</ThemedText>
        </View>
      )}
    </ThemedView>
  );
}
