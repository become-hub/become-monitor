/**
 * Polar Metrics Grid Component
 * Displays Polar device metrics (HR, HRV, LF/HF, RR, ECG, Temperature)
 */

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { Activity, Heart, Thermometer, Zap } from "lucide-react-native";
import { View } from "react-native";
import { MetricCard } from "./metric-card";
import { monitorStyles } from "./monitor-styles";
import type { RrSource } from "@/services/rr-interval";

interface PolarMetricsGridProps {
  connectedDeviceId: string | null;
  heartRate: number;
  hrv: number;
  lfPower: number;
  hfPower: number;
  rrMs: number;
  rrSource: RrSource | null;
  ecgMicroVolts: number;
  skinTemperatureC: number;
  ppiWindowLength: number;
  isH10Connected: boolean;
  showRawEcgCards: boolean;
  isSkinTemperatureSupported: boolean;
}

const WINDOW_SIZE = 30;

export function PolarMetricsGrid({
  connectedDeviceId,
  heartRate,
  hrv,
  lfPower,
  hfPower,
  rrMs,
  rrSource,
  ecgMicroVolts,
  skinTemperatureC,
  ppiWindowLength,
  isH10Connected,
  showRawEcgCards,
  isSkinTemperatureSupported,
}: PolarMetricsGridProps) {
  const { theme } = useTheme();

  return (
    <>
      {connectedDeviceId && heartRate === 0 && (
        <ThemedText style={monitorStyles.waitingText}>
          ⏳ In attesa di dati dal dispositivo...
        </ThemedText>
      )}
      {isH10Connected && (
        <ThemedText style={monitorStyles.waitingText}>
          H10 espone HR, RR ECG, ECG (uV), HRV (RMSSD) e LF/HF; non espone
          temperatura corporea/cutanea.
        </ThemedText>
      )}

      <View style={monitorStyles.metricsGrid}>
        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="Heart Rate"
            value={connectedDeviceId && heartRate > 0 ? heartRate : "—"}
            unit="BPM"
            icon={Heart}
            fullWidth
          />
        </View>

        {showRawEcgCards && (
          <View style={monitorStyles.metricsRow}>
            <MetricCard
              label="RR (ECG)"
              value={
                connectedDeviceId && rrMs > 0 && rrSource === "ecg_rr"
                  ? rrMs
                  : "—"
              }
              unit="ms · ecg_rr"
              icon={Activity}
              highlighted
            />
            <MetricCard
              label="ECG"
              value={connectedDeviceId && ecgMicroVolts !== 0 ? ecgMicroVolts : "—"}
              unit="µV"
              icon={Zap}
              highlighted
            />
          </View>
        )}

        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="HRV (RMSSD)"
            value={connectedDeviceId && hrv > 0 ? hrv : "—"}
            unit={
              connectedDeviceId && hrv > 0
                ? "ms"
                : connectedDeviceId && ppiWindowLength > 0
                ? `${ppiWindowLength}/${WINDOW_SIZE}`
                : "ms"
            }
            icon={Activity}
            fullWidth={showRawEcgCards}
          />

          {!showRawEcgCards && (
            <MetricCard
              label="RR"
              value={connectedDeviceId && rrMs > 0 ? rrMs : "—"}
              unit={
                rrSource === "ppi"
                  ? "ms · PPI"
                  : rrSource === "hr_derived"
                  ? "ms · HR"
                  : "ms"
              }
              icon={Activity}
            />
          )}
        </View>

        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="HF Power"
            value={connectedDeviceId && hfPower > 0 ? hfPower : "—"}
            unit="ms²"
            icon={Zap}
          />
          <MetricCard
            label="LF Power"
            value={connectedDeviceId && lfPower > 0 ? lfPower : "—"}
            unit="ms²"
            icon={Zap}
          />
        </View>

        {connectedDeviceId && isSkinTemperatureSupported && (
          <View style={monitorStyles.metricsRow}>
            <View
              style={[
                monitorStyles.metricCard,
                monitorStyles.metricCardFull,
                { borderColor: Colors[theme].border },
              ]}
            >
              <View style={monitorStyles.metricIconContainer}>
                <Thermometer
                  size={24}
                  color={skinTemperatureC > 38 ? "#EF4444" : Colors[theme].tint}
                />
              </View>
              <ThemedText style={monitorStyles.metricLabel}>
                Temperatura cute
              </ThemedText>
              <ThemedText style={monitorStyles.metricValue}>
                {skinTemperatureC > 0 ? skinTemperatureC.toFixed(1) : "—"}
              </ThemedText>
              <ThemedText style={monitorStyles.metricUnit}>°C</ThemedText>
              <ThemedText style={[monitorStyles.metricUnit, { marginTop: 6 }]}>
                {skinTemperatureC > 0
                  ? `${((skinTemperatureC * 9) / 5 + 32).toFixed(1)} °F`
                  : "—"}
              </ThemedText>
            </View>
          </View>
        )}
      </View>
    </>
  );
}
