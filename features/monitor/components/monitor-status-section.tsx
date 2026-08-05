/**
 * Monitor Status Section — compact panel + details accordion
 */

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Activity,
  AppWindow,
  Bluetooth,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Hash,
  Monitor,
  User,
  Watch,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, TouchableOpacity, View } from "react-native";
import { monitorStyles } from "./monitor-styles";

interface MonitorStatusSectionProps {
  bluetoothPowered: boolean;
  deviceName: string | null;
  streamingStatusText: string;
  isStreamingLive: boolean;
  ablyPulseTick: number;
  deviceCode: string;
  userId: number;
  appId: string;
  offlineRecordingStarted: boolean;
  connectedDeviceId: string | null;
  showRawEcgCards: boolean;
  authToken: string;
  authCode: string;
}

function offlineTrackLabel(
  offlineRecordingStarted: boolean,
  connectedDeviceId: string | null,
  showRawEcgCards: boolean
): string {
  if (offlineRecordingStarted) {
    return "Polar PPI attivo";
  }
  if (connectedDeviceId) {
    return showRawEcgCards ? "Buffer live (ECG RR)" : "Buffer live";
  }
  return "Off";
}

export function MonitorStatusSection({
  bluetoothPowered,
  deviceName,
  streamingStatusText,
  isStreamingLive,
  ablyPulseTick,
  deviceCode,
  userId,
  appId,
  offlineRecordingStarted,
  connectedDeviceId,
  showRawEcgCards,
  authToken,
  authCode,
}: MonitorStatusSectionProps) {
  const { theme } = useTheme();
  const tint = Colors[theme].tint;
  const border = Colors[theme].border;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isStreamingLive || ablyPulseTick <= 0) {
      return;
    }
    pulseAnim.setValue(1);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 0.25,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [ablyPulseTick, isStreamingLive, pulseAnim]);

  const bluetoothColor = bluetoothPowered ? "#22C55E" : "#9CA3AF";
  const deviceColor = deviceName ? tint : "#9CA3AF";
  const streamingColor = isStreamingLive
    ? "#22C55E"
    : streamingStatusText.toLowerCase().includes("attesa") ||
        streamingStatusText.toLowerCase().includes("connessione")
      ? "#F59E0B"
      : "#9CA3AF";

  return (
    <ThemedView style={monitorStyles.statusSection}>
      <ThemedView style={[monitorStyles.statusPanel, { borderColor: border }]}>
        <View style={monitorStyles.statusCompactRow}>
          <Bluetooth size={16} color={bluetoothColor} />
          <ThemedText style={monitorStyles.statusCompactLabel}>Bluetooth</ThemedText>
          <ThemedText style={monitorStyles.statusCompactValue}>
            {bluetoothPowered ? "Acceso" : "Spento"}
          </ThemedText>
        </View>

        <View style={monitorStyles.statusCompactRow}>
          <Watch size={16} color={deviceColor} />
          <ThemedText style={monitorStyles.statusCompactLabel}>Device</ThemedText>
          <ThemedText style={monitorStyles.statusCompactValue} numberOfLines={1}>
            {deviceName || "Nessun device"}
          </ThemedText>
        </View>

        <View style={monitorStyles.statusCompactRow}>
          <Animated.View style={{ opacity: isStreamingLive ? pulseAnim : 1 }}>
            <Activity size={16} color={streamingColor} />
          </Animated.View>
          <ThemedText style={monitorStyles.statusCompactLabel}>Streaming</ThemedText>
          <ThemedText style={monitorStyles.statusCompactValue} numberOfLines={1}>
            {streamingStatusText}
          </ThemedText>
        </View>

        <TouchableOpacity
          style={monitorStyles.statusAccordionHeader}
          onPress={() => setDetailsOpen((open) => !open)}
          accessibilityRole="button"
        >
          <ThemedText style={monitorStyles.statusAccordionTitle}>
            Dettagli sessione
          </ThemedText>
          {detailsOpen ? (
            <ChevronUp size={16} color={tint} />
          ) : (
            <ChevronDown size={16} color={tint} />
          )}
        </TouchableOpacity>

        {detailsOpen && (
          <View style={monitorStyles.statusAccordionBody}>
            <View style={monitorStyles.statusDetailRow}>
              <Hash size={14} color={tint} />
              <ThemedText style={monitorStyles.statusDetailLabel}>Device code</ThemedText>
              <ThemedText style={monitorStyles.statusDetailValue} numberOfLines={1}>
                {deviceCode || "N/A"}
              </ThemedText>
            </View>
            <View style={monitorStyles.statusDetailRow}>
              <User size={14} color={tint} />
              <ThemedText style={monitorStyles.statusDetailLabel}>User ID</ThemedText>
              <ThemedText style={monitorStyles.statusDetailValue}>
                {userId || "N/A"}
              </ThemedText>
            </View>
            <View style={monitorStyles.statusDetailRow}>
              <AppWindow size={14} color={tint} />
              <ThemedText style={monitorStyles.statusDetailLabel}>App ID</ThemedText>
              <ThemedText style={monitorStyles.statusDetailValue} numberOfLines={1}>
                {appId || "N/A"}
              </ThemedText>
            </View>
            <View style={monitorStyles.statusDetailRow}>
              <HardDrive size={14} color={tint} />
              <ThemedText style={monitorStyles.statusDetailLabel}>Offline track</ThemedText>
              <ThemedText style={monitorStyles.statusDetailValue} numberOfLines={1}>
                {offlineTrackLabel(
                  offlineRecordingStarted,
                  connectedDeviceId,
                  showRawEcgCards
                )}
              </ThemedText>
            </View>
          </View>
        )}
      </ThemedView>

      {!authToken && connectedDeviceId && authCode && (
        <View
          style={[
            monitorStyles.authCodeContainer,
            { borderColor: border },
          ]}
        >
          <View style={monitorStyles.authCodeHeader}>
            <View
              style={[
                monitorStyles.authCodeIconWrap,
                { backgroundColor: tint + "18" },
              ]}
            >
              <Monitor size={18} color={tint} />
            </View>
            <View style={monitorStyles.authCodeHeaderText}>
              <ThemedText style={monitorStyles.authCodeEyebrow}>
                Pairing Become Hub
              </ThemedText>
              <ThemedText style={monitorStyles.authCodeLabel}>
                Inserisci questo codice sul PC
              </ThemedText>
            </View>
          </View>

          <View style={monitorStyles.authCodeDigits}>
            {authCode.split("").map((digit, index) => (
              <View
                key={`${digit}-${index}`}
                style={[
                  monitorStyles.authCodeDigit,
                  { borderColor: border },
                ]}
              >
                <ThemedText style={[monitorStyles.authCodeDigitText, { color: tint }]}>
                  {digit}
                </ThemedText>
              </View>
            ))}
          </View>

          <ThemedText style={monitorStyles.authCodeHint}>
            Apri Become Hub → Devices e digita il codice per collegare questo
            dispositivo.
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}
