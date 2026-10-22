/**
 * Monitor Status Section — compact panel + details accordion
 */

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import type { HrvAnalysisMode } from "@/features/hrv/core/hrv-analysis-mode";
import { hrvProgressPercent } from "@/features/hrv/core/hrv-analysis-mode";
import type { AblySendStats } from "@/services/ably-service";
import { AblyLastEventModal } from "./ably-last-event-modal";
import {
  Activity,
  AppWindow,
  Bluetooth,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Hash,
  Heart,
  Monitor,
  User,
  Watch,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, TouchableOpacity, View } from "react-native";
import { monitorStyles } from "./monitor-styles";

interface MonitorStatusSectionProps {
  bluetoothPowered: boolean;
  deviceName: string | null;
  streamingStatusText: string;
  isStreamingLive: boolean;
  ablyPulseTick: number;
  /** Events acked by Ably this session + the last one (tap the count to inspect). */
  ablySendStats: AblySendStats;
  deviceCode: string;
  userId: number;
  appId: string;
  offlineRecordingStarted: boolean;
  connectedDeviceId: string | null;
  showRawEcgCards: boolean;
  authToken: string;
  authCode: string;
  /** When Polar metrics are shown and HRV is still filling. */
  showHrvLoading?: boolean;
  hrvAnalysisMode?: HrvAnalysisMode;
  hrvProgressLabel?: string;
  hrvWallElapsedLabel?: string;
  ppiWindowLength?: number;
  hrvAcceptedDurationMs?: number;
  isH10Connected?: boolean;
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
  ablySendStats,
  deviceCode,
  userId,
  appId,
  offlineRecordingStarted,
  connectedDeviceId,
  showRawEcgCards,
  authToken,
  authCode,
  showHrvLoading = false,
  hrvAnalysisMode = "client",
  hrvProgressLabel = "",
  hrvWallElapsedLabel = "",
  ppiWindowLength = 0,
  hrvAcceptedDurationMs = 0,
  isH10Connected = false,
}: MonitorStatusSectionProps) {
  const { theme } = useTheme();
  const tint = Colors[theme].tint;
  const border = Colors[theme].border;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [lastEventOpen, setLastEventOpen] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressPct = hrvProgressPercent(
    hrvAnalysisMode,
    ppiWindowLength,
    hrvAcceptedDurationMs
  );
  const hrvLoadingTitle =
    hrvAnalysisMode === "clinical"
      ? "Calcolo HRV (estesa)…"
      : "Calcolo HRV…";
  const hrvLoadingBody =
    hrvAnalysisMode === "clinical"
      ? isH10Connected
        ? "Attendiamo ~5 minuti di RR ECG puliti per RMSSD e LF/HF. Resta fermo."
        : "Attendiamo ~5 minuti di battiti puliti (PPI) per RMSSD e LF/HF. Resta fermo, sensore a contatto."
      : isH10Connected
        ? "Attendiamo 30 intervalli RR ECG puliti per calcolare RMSSD e LF/HF."
        : "Attendiamo 30 battiti puliti per calcolare RMSSD e LF/HF. Resta fermo, sensore a contatto.";
  const hrvLoadingMeta =
    hrvAnalysisMode === "clinical"
      ? `Segnale utile ${hrvProgressLabel || "00:00 / 05:00"}${
          hrvWallElapsedLabel ? ` · trascorsi ${hrvWallElapsedLabel}` : ""
        }`
      : `Battiti accettati ${hrvProgressLabel || `${ppiWindowLength}/30`}`;

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
          {ablySendStats.sent > 0 || ablySendStats.failed > 0 ? (
            <TouchableOpacity
              onPress={() => setLastEventOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`${ablySendStats.sent} eventi inviati, mostra l'ultimo`}
              hitSlop={8}
              style={[
                monitorStyles.statusEventBadge,
                {
                  backgroundColor:
                    (ablySendStats.failed > 0 ? "#EF4444" : tint) + "22",
                },
              ]}
            >
              <ThemedText
                style={[
                  monitorStyles.statusEventBadgeText,
                  { color: ablySendStats.failed > 0 ? "#EF4444" : tint },
                ]}
              >
                {ablySendStats.sent}
                {ablySendStats.failed > 0 ? ` · ${ablySendStats.failed}✕` : ""}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
        <AblyLastEventModal
          visible={lastEventOpen}
          stats={ablySendStats}
          onClose={() => setLastEventOpen(false)}
        />

        {showHrvLoading && (
          <View
            style={monitorStyles.hrvLoadingBanner}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progressPct }}
          >
            <View style={monitorStyles.hrvLoadingHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}
              >
                <Heart size={16} color={tint} />
                <ActivityIndicator size="small" color={tint} />
                <ThemedText style={monitorStyles.hrvLoadingTitle} numberOfLines={1}>
                  {hrvLoadingTitle}
                </ThemedText>
              </View>
              <ThemedText style={[monitorStyles.hrvLoadingPercent, { color: tint }]}>
                {progressPct}%
              </ThemedText>
            </View>
            <ThemedText style={monitorStyles.hrvLoadingBody}>
              {hrvLoadingBody}
            </ThemedText>
            <ThemedText style={monitorStyles.hrvLoadingMeta}>
              {hrvLoadingMeta}
            </ThemedText>
            <View
              style={[
                monitorStyles.hrvProgressTrack,
                { backgroundColor: tint + "22" },
              ]}
            >
              <View
                style={[
                  monitorStyles.hrvProgressFill,
                  {
                    width: `${progressPct}%`,
                    backgroundColor: tint,
                  },
                ]}
              />
            </View>
          </View>
        )}

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

      {!authToken && connectedDeviceId && (
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
                {authCode
                  ? "Inserisci questo codice sul PC"
                  : "Generazione codice…"}
              </ThemedText>
            </View>
          </View>

          {authCode ? (
            <View style={monitorStyles.authCodeDigits}>
              {authCode.split("").map((digit, index) => (
                <View
                  key={`${digit}-${index}`}
                  style={[
                    monitorStyles.authCodeDigit,
                    { borderColor: border },
                  ]}
                >
                  <ThemedText
                    style={[monitorStyles.authCodeDigitText, { color: tint }]}
                  >
                    {digit}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator color={tint} />
            </View>
          )}

          <ThemedText style={monitorStyles.authCodeHint}>
            {authCode
              ? "Apri Become Hub → Devices e digita il codice per collegare questo dispositivo."
              : "Attendi il codice a 4 cifre. Se non compare, in Developer Mode usa «Invalida token Become»."}
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}
