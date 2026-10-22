/**
 * Explains that LF/HF are estimated from wrist PPI, not native bracelet values.
 */

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { LF_HF_VS_ECG_TYPICAL_ERROR_PCT } from "@/features/hrv/ppi/ppi-sample-window";
import { X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";

interface LfHfEstimateModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LfHfEstimateModal({ visible, onClose }: LfHfEstimateModalProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];

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
              <ThemedText style={styles.title}>LF e HF stimati</ThemedText>
              <ThemedText style={styles.meta}>Potenza spettrale dal polso</ThemedText>
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

          <ThemedText style={styles.body}>
            LF e HF non arrivano dal bracciale: vengono interpretati come stima
            dai battiti misurati al polso. Possono scostarsi di circa ±
            {LF_HF_VS_ECG_TYPICAL_ERROR_PCT}% rispetto a una fascia al petto (es.
            Polar H10). Servono soprattutto per vedere se salgono o scendono
            nella stessa sessione, non come valori precisi al singolo numero.
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
  body: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
});
