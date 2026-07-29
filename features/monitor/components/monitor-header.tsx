/**
 * Monitor Header Component
 * Title and device menu
 */

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { MoreVertical, Trash2 } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { monitorStyles } from "./monitor-styles";

interface MonitorHeaderProps {
  titleDisplayName: string;
  subtitle: string;
  connectedDeviceId: string | null;
  deviceMenuOpen: boolean;
  setDeviceMenuOpen: (open: boolean) => void;
  onResetAuthSession: () => void;
}

export function MonitorHeader({
  titleDisplayName,
  subtitle,
  connectedDeviceId,
  deviceMenuOpen,
  setDeviceMenuOpen,
  onResetAuthSession,
}: MonitorHeaderProps) {
  const { theme } = useTheme();

  return (
    <ThemedView style={monitorStyles.header}>
      <View style={monitorStyles.titleRow}>
        <ThemedText type="title" style={monitorStyles.title}>
          {titleDisplayName}
        </ThemedText>
        {connectedDeviceId ? (
          <View style={monitorStyles.deviceMenuWrap}>
            <TouchableOpacity
              onPress={() => setDeviceMenuOpen(!deviceMenuOpen)}
              accessibilityRole="button"
              accessibilityLabel="Menu dispositivo"
              hitSlop={8}
              style={monitorStyles.deviceMenuButton}
            >
              <MoreVertical size={22} color={Colors[theme].tint} />
            </TouchableOpacity>
            {deviceMenuOpen && (
              <View
                style={[
                  monitorStyles.deviceMenuDropdown,
                  {
                    backgroundColor: Colors[theme].background,
                    borderColor: Colors[theme].border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={monitorStyles.deviceMenuItem}
                  onPress={onResetAuthSession}
                >
                  <Trash2 size={16} color="#EF4444" />
                  <ThemedText style={monitorStyles.deviceMenuItemTextDanger}>
                    Reset auth token
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}
      </View>
      <ThemedText style={monitorStyles.subtitle}>{subtitle}</ThemedText>
    </ThemedView>
  );
}
