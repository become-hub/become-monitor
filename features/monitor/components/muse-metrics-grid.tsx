/**
 * Muse Metrics Grid Component
 * Displays Muse device metrics (EEG channels, band powers, HR PPG, battery)
 */

import { ThemedText } from "@/components/themed-text";
import { Heart } from "lucide-react-native";
import { View } from "react-native";
import { MetricCard } from "./metric-card";
import { monitorStyles } from "./monitor-styles";

interface MuseMetricsGridProps {
  connectedDeviceId: string | null;
  eegTp9: number;
  eegAf7: number;
  eegAf8: number;
  eegTp10: number;
  bandDelta: number;
  bandTheta: number;
  bandAlpha: number;
  bandBeta: number;
  bandGamma: number;
  museHr: number;
  museBattery: number;
}

export function MuseMetricsGrid({
  connectedDeviceId,
  eegTp9,
  eegAf7,
  eegAf8,
  eegTp10,
  bandDelta,
  bandTheta,
  bandAlpha,
  bandBeta,
  bandGamma,
  museHr,
  museBattery,
}: MuseMetricsGridProps) {
  return (
    <>
      {connectedDeviceId && eegAf7 === 0 && (
        <ThemedText style={monitorStyles.waitingText}>
          In attesa di EEG dal Muse…
        </ThemedText>
      )}

      <View style={monitorStyles.metricsGrid}>
        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="TP9"
            value={eegTp9 !== 0 ? eegTp9.toFixed(1) : "—"}
            unit="µV"
          />
          <MetricCard
            label="AF7"
            value={eegAf7 !== 0 ? eegAf7.toFixed(1) : "—"}
            unit="µV"
          />
        </View>
        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="AF8"
            value={eegAf8 !== 0 ? eegAf8.toFixed(1) : "—"}
            unit="µV"
          />
          <MetricCard
            label="TP10"
            value={eegTp10 !== 0 ? eegTp10.toFixed(1) : "—"}
            unit="µV"
          />
        </View>
        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="Alpha"
            value={bandAlpha > 0 ? (bandAlpha * 100).toFixed(0) : "—"}
            unit="%"
          />
          <MetricCard
            label="Theta"
            value={bandTheta > 0 ? (bandTheta * 100).toFixed(0) : "—"}
            unit="%"
          />
        </View>
        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="Beta"
            value={bandBeta > 0 ? (bandBeta * 100).toFixed(0) : "—"}
            unit="%"
          />
          <MetricCard
            label="Delta / Gamma"
            value={
              bandDelta > 0 || bandGamma > 0
                ? `${(bandDelta * 100).toFixed(0)}/${(bandGamma * 100).toFixed(0)}`
                : "—"
            }
            unit="%"
          />
        </View>
        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="HR (PPG)"
            value={museHr > 0 ? museHr : "—"}
            unit="BPM"
            icon={Heart}
            pulse={museHr > 0}
            highlighted
          />
          <MetricCard
            label="Batteria"
            value={museBattery > 0 ? museBattery.toFixed(0) : "—"}
            unit="%"
          />
        </View>
      </View>
    </>
  );
}
