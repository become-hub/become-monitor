/**
 * Polar Metrics Grid Component
 * Displays Polar device metrics (HR, HRV, LF/HF, RR, ECG, Temperature)
 * plus compact signal-quality cards (contact / PPI error / motion).
 */

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  isPolarMotionPoor,
  isPolarPpiErrorPoor,
  isPolarSkinContactPoor,
  type PolarSignalQualityUi,
} from "@/features/monitor/hooks/polar-live-signal";
import type { RrSource } from "@/services/rr-interval";
import {
  Activity,
  Hand,
  Heart,
  PersonStanding,
  ShieldAlert,
  Thermometer,
  Zap,
} from "lucide-react-native";
import { View } from "react-native";
import { MetricCard } from "./metric-card";
import { monitorStyles } from "./monitor-styles";

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
  isSignalLost?: boolean;
  isH10Connected: boolean;
  showRawEcgCards: boolean;
  isSkinTemperatureSupported: boolean;
  polarSignalQuality?: PolarSignalQualityUi | null;
}

const WINDOW_SIZE = 30;

function contactLabel(quality: PolarSignalQualityUi | null | undefined): string {
  if (!quality || quality.contactStatusSupported !== true) {
    return "—";
  }
  return quality.contactStatus === true ? "OK" : "No";
}

function qualityLabel(quality: PolarSignalQualityUi | null | undefined): string {
  if (quality?.errorEstimate == null) {
    return "—";
  }
  return String(quality.errorEstimate);
}

function motionLabel(quality: PolarSignalQualityUi | null | undefined): string {
  if (quality?.blocker == null) {
    return "—";
  }
  return quality.blocker ? "Sì" : "No";
}

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
  isSignalLost = false,
  isH10Connected,
  showRawEcgCards,
  isSkinTemperatureSupported,
  polarSignalQuality = null,
}: PolarMetricsGridProps) {
  const { theme } = useTheme();
  const showQualityCards =
    !!connectedDeviceId && !isH10Connected && polarSignalQuality != null;
  const contactPoor =
    showQualityCards && isPolarSkinContactPoor(polarSignalQuality);
  const motionPoor =
    showQualityCards && isPolarMotionPoor(polarSignalQuality);
  const qualityPoor =
    showQualityCards && isPolarPpiErrorPoor(polarSignalQuality);
  /** Loose fit / weak optical signal without an explicit no-contact flag. */
  const showContactWearAlert = contactPoor || (qualityPoor && !motionPoor);

  return (
    <>
      {connectedDeviceId && heartRate === 0 && (
        <ThemedText style={monitorStyles.waitingText}>
          {isSignalLost
            ? "Nessun segnale dal sensore — riposiziona il dispositivo sul polso"
            : "In attesa di dati dal dispositivo…"}
        </ThemedText>
      )}
      {isH10Connected && (
        <ThemedText style={monitorStyles.waitingText}>
          H10 espone HR, RR ECG, ECG (uV), HRV (RMSSD) e LF/HF; non espone
          temperatura corporea/cutanea.
        </ThemedText>
      )}

      {(showContactWearAlert || motionPoor) && (
        <View style={monitorStyles.wearWarningStack}>
          {showContactWearAlert && (
            <View
              style={[
                monitorStyles.wearWarningBanner,
                monitorStyles.wearWarningBannerContact,
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <ShieldAlert size={18} color="#EF4444" />
                <ThemedText
                  style={[
                    monitorStyles.wearWarningTitle,
                    monitorStyles.wearWarningTitleContact,
                  ]}
                >
                  Sistema bene il bracciale
                </ThemedText>
              </View>
              <ThemedText style={monitorStyles.wearWarningBody}>
                Contatto con la pelle insufficiente
                {qualityPoor && !contactPoor
                  ? " o segnale ottico debole"
                  : ""}
                . Indossa il Polar sul polso a contatto diretto con la pelle
                (non sopra maniche o vestiti), a circa un dito dal polso.
                Stringilo abbastanza perché i LED verdi restino fermi contro la
                pelle, senza stringere fino a lasciarti un segno.
              </ThemedText>
            </View>
          )}

          {motionPoor && (
            <View
              style={[
                monitorStyles.wearWarningBanner,
                monitorStyles.wearWarningBannerMotion,
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <PersonStanding size={18} color="#D97706" />
                <ThemedText
                  style={[
                    monitorStyles.wearWarningTitle,
                    monitorStyles.wearWarningTitleMotion,
                  ]}
                >
                  Resta fermo
                </ThemedText>
              </View>
              <ThemedText style={monitorStyles.wearWarningBody}>
                Movimento rilevato: la misura PPI (intervallo battito-battito)
                è sensibile agli artefatti. Fermati, tieni il braccio rilassato
                e attendi qualche secondo senza camminare o gesticolare.
              </ThemedText>
            </View>
          )}
        </View>
      )}

      <View style={monitorStyles.metricsGrid}>
        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="Heart Rate"
            value={connectedDeviceId && heartRate > 0 ? heartRate : "—"}
            unit="BPM"
            icon={Heart}
            fullWidth
            pulse={!!connectedDeviceId && heartRate > 0}
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

        {showQualityCards && (
          <View style={monitorStyles.metricsRow}>
            <MetricCard
              label="Contatto"
              value={contactLabel(polarSignalQuality)}
              unit="pelle"
              icon={Hand}
              compact
              danger={contactPoor}
            />
            <MetricCard
              label="Errore PPI*"
              value={qualityLabel(polarSignalQuality)}
              unit="ms"
              icon={Activity}
              compact
              danger={qualityPoor}
            />
            <MetricCard
              label="Movimento"
              value={motionLabel(polarSignalQuality)}
              unit="blocker"
              icon={PersonStanding}
              compact
              danger={motionPoor}
            />
          </View>
        )}
        {showQualityCards && (
          <ThemedText style={monitorStyles.metricFootnote}>
            * PPI: intervallo tra un battito e il successivo. Serve a determinare
            HR e HRV. HRV, LF e HF si aggiornano solo con Errore PPI ≤ 10 ms; con
            valori più alti restano all’ultimo sano. Card rossa oltre 30 ms.
          </ThemedText>
        )}
      </View>
    </>
  );
}
