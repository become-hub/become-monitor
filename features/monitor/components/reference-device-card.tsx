/**
 * Reference device card (Developer Mode only): record a Polar H10 next to the 360/Loop
 * on the same phone clock and export both beat series as CSV.
 */

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import type { ReferenceRecorderSummary } from "@/features/hrv/reference/reference-recorder";
import type {
  ReferenceCandidate,
  ReferenceStatus,
} from "@/stores/reference-store";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { monitorStyles } from "./monitor-styles";

interface ReferenceDeviceCardProps {
  status: ReferenceStatus;
  candidates: ReferenceCandidate[];
  deviceName: string | null;
  errorMessage: string | null;
  summary: ReferenceRecorderSummary;
  bluetoothPowered: boolean;
  onScan: () => void;
  onConnect: (deviceId: string, name: string) => void;
  onDisconnect: () => void;
  onExport: () => void;
  onClear: () => void;
}

const STATUS_LABEL: Record<ReferenceStatus, string> = {
  idle: "Non connesso",
  scanning: "Ricerca H10…",
  connecting: "Connessione H10…",
  streaming: "H10 in registrazione",
  error: "Errore",
};

function formatSpanMmSs(summary: ReferenceRecorderSummary): string {
  if (summary.firstMs == null || summary.lastMs == null) return "0:00";
  const sec = Math.max(0, Math.round((summary.lastMs - summary.firstMs) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function ReferenceDeviceCard({
  status,
  candidates,
  deviceName,
  errorMessage,
  summary,
  bluetoothPowered,
  onScan,
  onConnect,
  onDisconnect,
  onExport,
  onClear,
}: ReferenceDeviceCardProps) {
  const { theme } = useTheme();
  const connecting = status === "connecting";
  const scanning = status === "scanning";
  const connected = status === "streaming";
  const hasRows = summary.primaryBeats + summary.referenceBeats > 0;

  return (
    <ThemedView style={monitorStyles.controlsSection}>
      <ThemedText style={monitorStyles.discoveredTitle}>
        Riferimento H10 (solo sviluppatore)
      </ThemedText>
      <ThemedText style={monitorStyles.discoveredDeviceId}>
        {STATUS_LABEL[status]}
        {deviceName ? ` · ${deviceName}` : ""}
      </ThemedText>
      {errorMessage ? (
        <ThemedText style={monitorStyles.discoveredDeviceId}>
          {errorMessage}
        </ThemedText>
      ) : null}

      {!connected ? (
        <TouchableOpacity
          style={[
            monitorStyles.button,
            monitorStyles.scanButton,
            { backgroundColor: Colors[theme].tint },
          ]}
          onPress={onScan}
          disabled={connecting || !bluetoothPowered}
        >
          {connecting || scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={monitorStyles.buttonText}>Cerca H10</ThemedText>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[monitorStyles.button, monitorStyles.disconnectButton]}
          onPress={onDisconnect}
        >
          <ThemedText style={monitorStyles.buttonText}>Disconnetti H10</ThemedText>
        </TouchableOpacity>
      )}

      {!connected &&
        candidates.map((device) => (
          <TouchableOpacity
            key={device.deviceId}
            style={[
              monitorStyles.discoveredItem,
              { borderColor: Colors[theme].border },
            ]}
            onPress={() => onConnect(device.deviceId, device.name)}
            disabled={status === "connecting"}
            accessibilityRole="button"
            accessibilityLabel={`Connetti ${device.name} come riferimento`}
          >
            <View style={monitorStyles.discoveredItemText}>
              <ThemedText style={monitorStyles.discoveredName} numberOfLines={1}>
                {device.name}
              </ThemedText>
              <ThemedText
                style={monitorStyles.discoveredDeviceId}
                numberOfLines={1}
              >
                {device.deviceId}
              </ThemedText>
            </View>
            <ThemedText
              style={[monitorStyles.connectHint, { color: Colors[theme].tint }]}
            >
              Connetti
            </ThemedText>
          </TouchableOpacity>
        ))}

      <ThemedText style={monitorStyles.discoveredDeviceId}>
        Battiti 360: {summary.primaryBeats} · RR H10: {summary.referenceBeats} ·
        durata {formatSpanMmSs(summary)}
        {summary.dropped > 0 ? ` · scartati ${summary.dropped}` : ""}
      </ThemedText>

      {hasRows ? (
        <View style={monitorStyles.connectedButtons}>
          <TouchableOpacity
            style={[
              monitorStyles.button,
              monitorStyles.flushButton,
              { backgroundColor: Colors[theme].tint },
            ]}
            onPress={onExport}
          >
            <ThemedText style={monitorStyles.buttonText}>Esporta CSV</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[monitorStyles.button, monitorStyles.clearButton]}
            onPress={onClear}
          >
            <ThemedText style={monitorStyles.buttonText}>Azzera</ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}
    </ThemedView>
  );
}
