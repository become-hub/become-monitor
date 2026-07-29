/**
 * Shared Metric Card Component
 * Reusable card for displaying a single metric
 */

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import type { LucideIcon } from "lucide-react-native";
import { View, type ViewStyle } from "react-native";
import { monitorStyles } from "./monitor-styles";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon?: LucideIcon;
  highlighted?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  highlighted = false,
  fullWidth = false,
  style,
}: MetricCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        monitorStyles.metricCard,
        fullWidth && monitorStyles.metricCardFull,
        highlighted && monitorStyles.metricCardHighlight,
        {
          borderColor: highlighted ? Colors[theme].tint : Colors[theme].border,
        },
        style,
      ]}
    >
      {Icon && (
        <View style={monitorStyles.metricIconContainer}>
          <Icon size={24} color={Colors[theme].tint} />
        </View>
      )}
      <ThemedText style={monitorStyles.metricLabel}>{label}</ThemedText>
      <ThemedText style={monitorStyles.metricValue}>{value}</ThemedText>
      <ThemedText style={monitorStyles.metricUnit}>{unit}</ThemedText>
    </View>
  );
}
