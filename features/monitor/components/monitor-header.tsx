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
  /** Developer Mode: show ⋮ to invalidate Become auth token. */
  developerMode: boolean;
  deviceMenuOpen: boolean;
  setDeviceMenuOpen: (open: boolean) => void;
  onResetAuthSession: () => void;
}

export function MonitorHeader({
  titleDisplayName,
  subtitle,
  connectedDeviceId,
  developerMode,
  deviceMenuOpen,
  setDeviceMenuOpen,
  onResetAuthSession,
}: MonitorHeaderProps) {
  const { theme } = useTheme();
  const showDevAuthMenu = developerMode && !!connectedDeviceId;

  return (
    <ThemedView style={monitorStyles.header}>
      <View style={monitorStyles.titleRow}>
        <ThemedText type="title" style={monitorStyles.title}>
          {titleDisplayName}
        </ThemedText>
        {showDevAuthMenu ? (
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
                    Invalida token Become
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
