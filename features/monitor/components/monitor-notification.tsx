/**
 * Monitor Notification Component
 * Success/error notification banner
 */

import { ThemedText } from "@/components/themed-text";
import { CheckCircle, Unplug, XCircle } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { monitorStyles } from "./monitor-styles";
import type { NotificationType } from "../hooks/use-monitor-session";

interface MonitorNotificationProps {
  notification: NotificationType;
  onClose: () => void;
}

export function MonitorNotification({ notification, onClose }: MonitorNotificationProps) {
  if (!notification) return null;

  return (
    <View
      style={[
        monitorStyles.notification,
        notification.type === "success"
          ? monitorStyles.notificationSuccess
          : monitorStyles.notificationError,
      ]}
    >
      {notification.type === "success" ? (
        <CheckCircle size={24} color="#fff" />
      ) : notification.message.includes("disconnesso") ? (
        <Unplug size={24} color="#fff" />
      ) : (
        <XCircle size={24} color="#fff" />
      )}
      <ThemedText style={monitorStyles.notificationText}>
        {notification.message}
      </ThemedText>
      <TouchableOpacity
        onPress={onClose}
        style={monitorStyles.notificationCloseButton}
      >
        <XCircle size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
