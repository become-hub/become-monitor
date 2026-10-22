/**
 * LF/HF quality (low / medium / high) and progress toward the next level,
 * driven by the weakest of accepted ratio, artifact gap and window length.
 */

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  lfHfQualityLevel,
  type LfHfProgress,
  type LfHfQualityLevel,
  type LfHfRequirementProgress,
  type LfHfStatus,
} from "@/services/hrv-calculator";
import { LF_HF_PPI_ERROR_ESTIMATE_MAX_MS } from "@/services/ppi-sample-window";
import { View } from "react-native";
import { monitorStyles } from "./monitor-styles";

const MET_COLOR = "#10B981";
const PENDING_COLOR = "#F59E0B";
const BLOCKED_COLOR = "#EF4444";
const TRACK_COLOR = "rgba(127, 127, 127, 0.2)";

const QUALITY_LABEL: Record<LfHfQualityLevel, string> = {
  0: "—",
  1: "Bassa",
  2: "Media",
  3: "Ottima",
};

function formatSeconds(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function requirementText(r: LfHfRequirementProgress): {
  label: string;
  value: string;
} {
  switch (r.key) {
    case "acceptedRatio":
      return {
        label: "Battiti buoni",
        value: `${Math.round(r.current * 100)}% / ≥ ${Math.round(r.target * 100)}%`,
      };
    case "maxArtifactGapSec":
      return {
        label: "Buco più lungo",
        value: `${r.current.toFixed(1)} s / ≤ ${r.target} s`,
      };
    case "duration":
      return {
        label: "Durata finestra",
        value: `${formatSeconds(r.current)} / ${formatSeconds(r.target)}`,
      };
  }
}

function hintFor(progress: LfHfProgress): string | null {
  const unmet = progress.requirements.filter((r) => !r.met);
  if (unmet.length === 0) return null;
  const qualityBlocked = unmet.some((r) => r.key !== "duration");
  if (!qualityBlocked) return "Resta così: serve solo altro tempo.";
  return (
    `Troppi battiti scartati dal sensore (errore PPI > ${LF_HF_PPI_ERROR_ESTIMATE_MAX_MS} ms). ` +
    "Stringi il bracciale sopra l'osso del polso e tieni il braccio fermo: " +
    "la percentuale sale man mano che i battiti vecchi escono dalla finestra di 5 min."
  );
}

function Bar({
  progress,
  color,
  small = false,
}: {
  progress: number;
  color: string;
  small?: boolean;
}) {
  return (
    <View
      style={[
        small
          ? monitorStyles.lfHfProgressTrackSmall
          : monitorStyles.lfHfProgressTrack,
        { backgroundColor: TRACK_COLOR },
      ]}
    >
      <View
        style={[
          monitorStyles.lfHfProgressFill,
          {
            width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

export function LfHfProgressCard({
  status,
  progress,
}: {
  status: LfHfStatus;
  progress: LfHfProgress;
}) {
  const { theme } = useTheme();
  const title = `Qualità LF/HF · ${QUALITY_LABEL[lfHfQualityLevel(status)]}`;

  if (progress.nextStatus == null) {
    return (
      <View
        style={[
          monitorStyles.lfHfProgressCard,
          { borderColor: Colors[theme].border },
        ]}
      >
        <View style={monitorStyles.lfHfProgressHeader}>
          <ThemedText style={monitorStyles.lfHfProgressTitle}>{title}</ThemedText>
          <ThemedText
            style={[monitorStyles.lfHfProgressPercent, { color: MET_COLOR }]}
          >
            100%
          </ThemedText>
        </View>
        <Bar progress={1} color={MET_COLOR} />
      </View>
    );
  }

  const qualityBlocked = progress.requirements.some(
    (r) => !r.met && r.key !== "duration"
  );
  const overallColor = qualityBlocked ? BLOCKED_COLOR : PENDING_COLOR;
  const hint = hintFor(progress);

  return (
    <View
      style={[
        monitorStyles.lfHfProgressCard,
        { borderColor: Colors[theme].border },
      ]}
    >
      <View style={monitorStyles.lfHfProgressHeader}>
        <ThemedText style={monitorStyles.lfHfProgressTitle}>{title}</ThemedText>
        <ThemedText
          style={[monitorStyles.lfHfProgressPercent, { color: overallColor }]}
        >
          {Math.round(progress.overall * 100)}%
        </ThemedText>
      </View>
      <Bar progress={progress.overall} color={overallColor} />

      {progress.requirements.map((r) => {
        const text = requirementText(r);
        return (
          <View key={r.key} style={monitorStyles.lfHfRequirementRow}>
            <View style={monitorStyles.lfHfRequirementLabelRow}>
              <ThemedText style={monitorStyles.lfHfRequirementLabel}>
                {r.met ? "✓ " : ""}
                {text.label}
              </ThemedText>
              <ThemedText style={monitorStyles.lfHfRequirementLabel}>
                {text.value}
              </ThemedText>
            </View>
            <Bar
              progress={r.progress}
              color={
                r.met
                  ? MET_COLOR
                  : r.key === "duration"
                    ? PENDING_COLOR
                    : BLOCKED_COLOR
              }
              small
            />
          </View>
        );
      })}

      {hint && <ThemedText style={monitorStyles.lfHfHint}>{hint}</ThemedText>}
    </View>
  );
}
