/**
 * Explains LF/HF ratio plausibility bands shown on the Monitor card.
 */

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  assessLfHfRatio,
  LF_HF_RATIO_BANDS,
  type LfHfRatioSeverity,
} from "@/features/hrv/core/hrv-calculator";
import { X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

interface LfHfRatioThresholdsModalProps {
  visible: boolean;
  onClose: () => void;
  /** Current ratio, when available, to highlight the matching band. */
  currentRatio?: number | null;
}

const SEVERITY_COLOR: Record<LfHfRatioSeverity, string> = {
  ok: "#10B981",
  warn: "#D97706",
  danger: "#EF4444",
};

export function LfHfRatioThresholdsModal({
  visible,
  onClose,
  currentRatio = null,
}: LfHfRatioThresholdsModalProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const assessment = assessLfHfRatio(currentRatio);
  const hasRatio = assessment != null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>Soglie LF/HF</ThemedText>
              <ThemedText style={styles.meta}>
                {hasRatio
                  ? `Valore attuale: ${Math.round(currentRatio! * 100) / 100}`
                  : "Rapporto potenza LF ÷ HF"}
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Chiudi"
              hitSlop={12}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.intro}>
            Queste fasce sono solo una guida di plausibilità sul polso (PPI),
            non cut-off clinici. Servono a capire se il numero ha senso nella
            sessione, soprattutto con qualità Media o Bassa.
          </ThemedText>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {LF_HF_RATIO_BANDS.map((band) => {
              const active = assessment?.label === band.label;
              const accent = SEVERITY_COLOR[band.severity];
              return (
                <View
                  key={band.rangeLabel}
                  style={[
                    styles.row,
                    {
                      borderColor: active ? accent : colors.border,
                      backgroundColor: active ? accent + "14" : "transparent",
                    },
                  ]}
                >
                  <View style={styles.rowHeader}>
                    <View style={[styles.dot, { backgroundColor: accent }]} />
                    <ThemedText style={styles.range}>{band.rangeLabel}</ThemedText>
                    <ThemedText style={[styles.label, { color: accent }]}>
                      {band.label}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.hint}>{band.hint}</ThemedText>
                </View>
              );
            })}
          </ScrollView>

          <ThemedText style={styles.footer}>
            Con valori alti controlla Contatto, Movimento e Qualità LF/HF prima
            di interpretare lo stress.
          </ThemedText>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    maxHeight: "85%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  meta: {
    fontSize: 12,
    opacity: 0.6,
  },
  intro: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 8,
    paddingBottom: 4,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  range: {
    fontSize: 13,
    fontWeight: "700",
    minWidth: 72,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.75,
    paddingLeft: 16,
  },
  footer: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.65,
  },
});
