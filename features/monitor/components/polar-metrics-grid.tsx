/**
 * Polar Metrics Grid Component
 * Displays Polar device metrics (HR, HRV, LF/HF, RR, ECG, Temperature)
 * plus compact signal-quality cards (contact / PPI error / motion).
 */

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import type { HrvAnalysisMode } from "@/features/hrv/core/hrv-analysis-mode";
import {
  isPolarMotionPoor,
  isPolarPpiErrorPoor,
  isPolarSkinContactPoor,
  type PolarSignalQualityUi,
} from "@/features/monitor/hooks/polar-live-signal";
import {
  assessLfHfRatio,
  lfHfQualityLevel,
  type LfHfProgress,
  type LfHfQualityLevel,
  type LfHfStatus,
} from "@/features/hrv/core/hrv-calculator";
import { LF_HF_PPI_ERROR_ESTIMATE_MAX_MS } from "@/features/hrv/ppi/ppi-sample-window";
import type { RrSource } from "@/features/hrv/ppi/rr-interval";
import {
  Activity,
  Hand,
  Heart,
  PersonStanding,
  Scale,
  ShieldAlert,
  Thermometer,
  Zap,
} from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { LfHfEstimateModal } from "./lf-hf-estimate-modal";
import { LfHfProgressCard } from "./lf-hf-progress-card";
import { LfHfRatioThresholdsModal } from "./lf-hf-ratio-thresholds-modal";
import { MetricCard } from "./metric-card";
import { monitorStyles } from "./monitor-styles";

interface PolarMetricsGridProps {
  connectedDeviceId: string | null;
  heartRate: number;
  hrv: number;
  lfPower: number;
  hfPower: number;
  lfHfStatus?: LfHfStatus;
  lfHfProgress?: LfHfProgress | null;
  lfHfRatio?: number | null;
  rrMs: number;
  rrSource: RrSource | null;
  ecgMicroVolts: number;
  skinTemperatureC: number;
  ppiWindowLength: number;
  hrvProgressLabel?: string;
  hrvWallElapsedLabel?: string;
  hrvAnalysisMode?: HrvAnalysisMode;
  hrvEpochInvalid?: boolean;
  isSignalLost?: boolean;
  isH10Connected: boolean;
  showRawEcgCards: boolean;
  isSkinTemperatureSupported: boolean;
  polarSignalQuality?: PolarSignalQualityUi | null;
}

function contactLabel(
  quality: PolarSignalQualityUi | null | undefined,
): string {
  if (!quality || quality.contactStatusSupported !== true) {
    return "—";
  }
  return quality.contactStatus === true ? "OK" : "No";
}

function qualityLabel(
  quality: PolarSignalQualityUi | null | undefined,
): string {
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

const LF_HF_UNIT: Record<LfHfQualityLevel, string> = {
  0: "ms²",
  1: "ms² · bassa qualità",
  2: "ms² · media qualità",
  3: "ms² · ottima qualità",
};

export function PolarMetricsGrid({
  connectedDeviceId,
  heartRate,
  hrv,
  lfPower,
  hfPower,
  lfHfStatus = "unavailable",
  lfHfProgress = null,
  lfHfRatio = null,
  rrMs,
  rrSource,
  ecgMicroVolts,
  skinTemperatureC,
  ppiWindowLength,
  hrvProgressLabel,
  hrvWallElapsedLabel,
  hrvAnalysisMode = "client",
  hrvEpochInvalid = false,
  isSignalLost = false,
  isH10Connected,
  showRawEcgCards,
  isSkinTemperatureSupported,
  polarSignalQuality = null,
}: PolarMetricsGridProps) {
  const { theme } = useTheme();
  const [lfHfThresholdsOpen, setLfHfThresholdsOpen] = useState(false);
  const [lfHfEstimateOpen, setLfHfEstimateOpen] = useState(false);
  const showQualityCards =
    !!connectedDeviceId && !isH10Connected && polarSignalQuality != null;
  const contactPoor =
    showQualityCards && isPolarSkinContactPoor(polarSignalQuality);
  const motionPoor = showQualityCards && isPolarMotionPoor(polarSignalQuality);
  const qualityPoor =
    showQualityCards && isPolarPpiErrorPoor(polarSignalQuality);
  /** Loose fit / weak optical signal without an explicit no-contact flag. */
  const showContactWearAlert = contactPoor || (qualityPoor && !motionPoor);
  const ratioAssessment = assessLfHfRatio(lfHfRatio);
  const ratioValue =
    connectedDeviceId && lfHfRatio != null && lfHfRatio > 0
      ? Math.round(lfHfRatio * 100) / 100
      : "—";
  const ratioUnit = ratioAssessment?.label ?? "LF ÷ HF";
  const ratioWarn = ratioAssessment?.severity === "warn";
  const ratioDanger = ratioAssessment?.severity === "danger";
  const progressLabel =
    hrvProgressLabel ?? (ppiWindowLength > 0 ? `${ppiWindowLength}/30` : "");
  const hrvSourceBadge = isH10Connected
    ? "ECG RR"
    : rrSource === "ppi"
    ? "PPI"
    : rrSource === "hr_derived"
    ? "HR"
    : null;
  const showHrvProgress =
    !!connectedDeviceId && hrv <= 0 && progressLabel.length > 0;

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
              value={
                connectedDeviceId && ecgMicroVolts !== 0 ? ecgMicroVolts : "—"
              }
              unit="µV"
              icon={Zap}
              highlighted
            />
          </View>
        )}

        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label={
              hrvSourceBadge ? `HRV (RMSSD) · ${hrvSourceBadge}` : "HRV (RMSSD)"
            }
            value={connectedDeviceId && hrv > 0 ? hrv : "—"}
            unit={
              connectedDeviceId && hrv > 0
                ? "ms"
                : connectedDeviceId &&
                  hrvAnalysisMode === "clinical" &&
                  hrvWallElapsedLabel
                ? `utile ${progressLabel || "00:00 / 05:00"}`
                : showHrvProgress
                ? progressLabel
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

        {connectedDeviceId && hrvAnalysisMode === "clinical" && (
          <ThemedText style={monitorStyles.waitingText}>
            {hrvEpochInvalid
              ? "Acquisizione estesa non riuscita — ripartita. Resta fermo."
              : hrv > 0
              ? `Estesa: ultimo risultato ok. Nuova acquisizione ${
                  progressLabel || "00:00 / 05:00"
                } · trascorsi ${hrvWallElapsedLabel || "00:00"}`
              : progressLabel && !progressLabel.startsWith("00:00")
              ? `Estesa: segnale utile ${progressLabel} · trascorsi ${
                  hrvWallElapsedLabel || "00:00"
                }`
              : `Estesa: in attesa di segnale stabile… trascorsi ${
                  hrvWallElapsedLabel || "00:00"
                } (servono ~5 min utili)`}
          </ThemedText>
        )}

        <View style={monitorStyles.metricsRow}>
          <MetricCard
            label="HF Power"
            value={connectedDeviceId && hfPower > 0 ? hfPower : "—"}
            unit={
              connectedDeviceId
                ? LF_HF_UNIT[lfHfQualityLevel(lfHfStatus)]
                : "ms²"
            }
            icon={Zap}
            onPress={
              connectedDeviceId && !isH10Connected
                ? () => setLfHfEstimateOpen(true)
                : undefined
            }
            accessibilityLabel="HF Power, tocca per info sulla stima"
          />
          <MetricCard
            label="LF Power"
            value={connectedDeviceId && lfPower > 0 ? lfPower : "—"}
            unit={
              connectedDeviceId
                ? LF_HF_UNIT[lfHfQualityLevel(lfHfStatus)]
                : "ms²"
            }
            icon={Zap}
            onPress={
              connectedDeviceId && !isH10Connected
                ? () => setLfHfEstimateOpen(true)
                : undefined
            }
            accessibilityLabel="LF Power, tocca per info sulla stima"
          />
        </View>

        {connectedDeviceId && !isH10Connected && lfHfProgress && (
          <LfHfProgressCard status={lfHfStatus} progress={lfHfProgress} />
        )}

        <LfHfEstimateModal
          visible={lfHfEstimateOpen}
          onClose={() => setLfHfEstimateOpen(false)}
        />

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
          <>
            <View style={monitorStyles.metricsRow}>
              <MetricCard
                label="LF/HF"
                value={ratioValue}
                unit={ratioUnit}
                icon={Scale}
                compact
                warning={ratioWarn}
                danger={ratioDanger}
                onPress={() => setLfHfThresholdsOpen(true)}
                accessibilityLabel="LF/HF, tocca per le soglie di plausibilità"
              />
              <MetricCard
                label="Errore PPI*"
                value={qualityLabel(polarSignalQuality)}
                unit="ms"
                icon={Activity}
                compact
                danger={qualityPoor}
              />
            </View>
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
                label="Movimento"
                value={motionLabel(polarSignalQuality)}
                unit="blocker"
                icon={PersonStanding}
                compact
                danger={motionPoor}
              />
            </View>
          </>
        )}

        {connectedDeviceId && isH10Connected && (
          <View style={monitorStyles.metricsRow}>
            <MetricCard
              label="LF/HF"
              value={ratioValue}
              unit={ratioUnit}
              icon={Scale}
              compact
              warning={ratioWarn}
              danger={ratioDanger}
              onPress={() => setLfHfThresholdsOpen(true)}
              accessibilityLabel="LF/HF, tocca per le soglie di plausibilità"
            />
          </View>
        )}

        <LfHfRatioThresholdsModal
          visible={lfHfThresholdsOpen}
          onClose={() => setLfHfThresholdsOpen(false)}
          currentRatio={
            typeof ratioValue === "number" ? ratioValue : lfHfRatio
          }
        />

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
                  Stringilo abbastanza perché i LED verdi restino fermi contro
                  la pelle, senza stringere fino a lasciarti un segno.
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
                  è sensibile agli artefatti. Fermati, tieni il braccio
                  rilassato e attendi qualche secondo senza camminare o
                  gesticolare.
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {showQualityCards && (
          <ThemedText style={monitorStyles.metricFootnote}>
            Tocca LF/HF per le soglie di plausibilità. * PPI: intervallo tra un
            battito e il successivo. HRV usa Errore PPI ≤ 10 ms, LF e HF ≤{" "}
            {LF_HF_PPI_ERROR_ESTIMATE_MAX_MS} ms
            {hrvAnalysisMode === "clinical"
              ? " e senza movimento (blocker)."
              : "; con valori più alti restano all’ultimo sano."}{" "}
            Card Errore PPI rossa oltre 30 ms.
            {hrvAnalysisMode === "clinical"
              ? " Modalità estesa: epoch da 5 minuti di segnale pulito (non certificazione medicale)."
              : ""}
          </ThemedText>
        )}
        {isH10Connected && hrvAnalysisMode === "clinical" && (
          <ThemedText style={monitorStyles.metricFootnote}>
            H10 in modalità estesa: HRV/LF/HF da RR ECG su epoch da 5 minuti
            (allineamento alle linee guida short-term, non certificazione
            medicale).
          </ThemedText>
        )}
      </View>
    </>
  );
}
