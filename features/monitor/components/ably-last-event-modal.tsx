/**
 * Popup with the last Ably event published (formatted, long series summarized).
 */

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { buildAblyEventView } from "@/features/monitor/hooks/format-ably-event";
import type { AblySendStats } from "@/services/ably-service";
import { X } from "lucide-react-native";
import { useMemo } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

interface AblyLastEventModalProps {
  visible: boolean;
  stats: AblySendStats;
  onClose: () => void;
}

export function AblyLastEventModal({
  visible,
  stats,
  onClose,
}: AblyLastEventModalProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  // Re-format only while open: the event changes every second.
  const view = useMemo(
    () => (visible ? buildAblyEventView(stats) : null),
    [visible, stats]
  );

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
              <ThemedText style={styles.title}>
                {view?.title ?? "Nessun evento inviato"}
              </ThemedText>
              {view ? <ThemedText style={styles.meta}>{view.meta}</ThemedText> : null}
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

          {stats.lastError ? (
            <ThemedText style={styles.error}>
              Ultimo errore Ably: {stats.lastError}
            </ThemedText>
          ) : null}

          <ScrollView
            style={[styles.bodyBox, { borderColor: colors.border }]}
            contentContainerStyle={styles.bodyContent}
          >
            <ThemedText selectable style={styles.body}>
              {view?.body ?? "—"}
            </ThemedText>
          </ScrollView>
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
  error: {
    fontSize: 12,
    color: "#EF4444",
  },
  bodyBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  bodyContent: {
    padding: 10,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
});
