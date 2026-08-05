/**
 * In-app Polar 360 / Loop Gen 2 setup guide modal.
 */

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/hooks/use-locale";
import { X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PolarSetupGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PolarSetupGuideModal({
  visible,
  onClose,
}: PolarSetupGuideModalProps) {
  const { theme } = useTheme();
  const { strings } = useLocale();
  const insets = useSafeAreaInsets();
  const tint = Colors[theme].tint;
  const bg = Colors[theme].background;
  const border = Colors[theme].border;
  const steps = strings.docs.polarSetupGuideSteps;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: bg,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: border }]} />
        </View>

        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText style={styles.title}>
              {strings.docs.polarSetupGuideTitle}
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              {strings.docs.polarSetupGuideSubtitle}
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: `${tint}14` }]}
            accessibilityRole="button"
            accessibilityLabel={strings.docs.polarSetupGuideDone}
          >
            <X size={18} color={tint} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {steps.map((step, index) => (
            <View key={`polar-step-${index}`} style={styles.stepRow}>
              <View style={[styles.stepBadge, { backgroundColor: `${tint}18` }]}>
                <ThemedText style={[styles.stepNumber, { color: tint }]}>
                  {index + 1}
                </ThemedText>
              </View>
              <ThemedText style={styles.stepText}>{step}</ThemedText>
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={[styles.doneBtn, { backgroundColor: tint }]}
        >
          <ThemedText style={styles.doneBtnText}>
            {strings.docs.polarSetupGuideDone}
          </ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: 20,
  },
  handleRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
    gap: 16,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
  },
  doneBtn: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
