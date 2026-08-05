/**
 * Monitor Actions Component
 * Scan, connect, disconnect, and flush buttons
 */

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { isMuseFamilyAvailable } from "@/constants/device-availability";
import {
  getMuseProductBadge,
  isSupportedMuseDevice,
  MUSE_PRODUCTS,
  type MuseProductId,
} from "@/features/devices/muse/muse-products";
import {
  getPolarProductBadge,
  POLAR_PRODUCTS,
  type PolarProductId,
} from "@/features/devices/polar/polar-products";
import type { DiscoveredDevice } from "@/stores/scan-store";
import { Image } from "expo-image";
import { Search, Trash2 } from "lucide-react-native";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { monitorStyles } from "./monitor-styles";

const POLAR_DEVICE_IMAGES: Record<PolarProductId, number> = {
  polar_360: require("@/assets/images/polar360.webp"),
  polar_loop: require("@/assets/images/polar-loop.png"),
  polar_h10: require("@/assets/images/polar-h10.png"),
};

const MUSE_DEVICE_IMAGES: Record<MuseProductId, number> = {
  muse_2: require("@/assets/images/muse-2.png"),
};

function getDiscoveredDeviceImage(device: DiscoveredDevice): number | null {
  if (device.family === "muse") {
    const product = MUSE_PRODUCTS[device.productId as MuseProductId];
    return product ? MUSE_DEVICE_IMAGES[product.id] : null;
  }
  const product = POLAR_PRODUCTS[device.productId as PolarProductId];
  return product ? POLAR_DEVICE_IMAGES[product.id] : null;
}

interface MonitorActionsProps {
  connectedDeviceId: string | null;
  isScanning: boolean;
  isConnectingSelected: boolean;
  bluetoothPowered: boolean;
  discoveredDevices: DiscoveredDevice[];
  foundDeviceName: string;
  isFlushingTrack: boolean;
  debugMode: boolean;
  authToken: string;
  disconnectButtonLabel: string;
  onStartScan: () => void;
  onSelectAndConnect: (deviceId: string, family?: "polar" | "muse") => void;
  onDisconnect: () => void;
  onFlushTrack: () => void;
  onClearStoredAuth: () => void;
}

export function MonitorActions({
  connectedDeviceId,
  isScanning,
  isConnectingSelected,
  bluetoothPowered,
  discoveredDevices,
  foundDeviceName,
  isFlushingTrack,
  debugMode,
  authToken,
  disconnectButtonLabel,
  onStartScan,
  onSelectAndConnect,
  onDisconnect,
  onFlushTrack,
  onClearStoredAuth,
}: MonitorActionsProps) {
  const { theme } = useTheme();

  return (
    <ThemedView style={monitorStyles.controlsSection}>
      {!connectedDeviceId ? (
        <>
          <TouchableOpacity
            style={[
              monitorStyles.button,
              monitorStyles.scanButton,
              { backgroundColor: Colors[theme].tint },
            ]}
            onPress={onStartScan}
            disabled={isScanning || isConnectingSelected || !bluetoothPowered}
          >
            {isScanning ? (
              <>
                <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                <ThemedText style={monitorStyles.buttonText}>
                  Scansione in corso...
                </ThemedText>
              </>
            ) : (
              <View style={monitorStyles.buttonContent}>
                <Search size={20} color="#fff" />
                <ThemedText style={monitorStyles.buttonText}>
                  {isMuseFamilyAvailable()
                    ? "Cerca Dispositivo Polar / Muse"
                    : "Cerca Dispositivo Polar"}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>

          {(discoveredDevices.length > 0 || isConnectingSelected) && (
            <ThemedView style={monitorStyles.discoveredList}>
              <ThemedText style={monitorStyles.discoveredTitle}>
                Seleziona un dispositivo
              </ThemedText>
              {isConnectingSelected && (
                <View style={monitorStyles.connectingRow}>
                  <ActivityIndicator color={Colors[theme].tint} />
                  <ThemedText style={monitorStyles.connectingText}>
                    Connessione in corso…
                  </ThemedText>
                </View>
              )}
              {discoveredDevices.map((device) => {
                const deviceImage = getDiscoveredDeviceImage(device);
                return (
                  <TouchableOpacity
                    key={device.deviceId}
                    style={[
                      monitorStyles.discoveredItem,
                      { borderColor: Colors[theme].border },
                    ]}
                    onPress={() =>
                      onSelectAndConnect(device.deviceId, device.family)
                    }
                    disabled={isConnectingSelected}
                    accessibilityRole="button"
                    accessibilityLabel={`Connetti ${device.displayName}`}
                  >
                    <View style={monitorStyles.discoveredIconWrap}>
                      {deviceImage != null ? (
                        <Image
                          source={deviceImage}
                          style={monitorStyles.discoveredDeviceImage}
                          contentFit="contain"
                        />
                      ) : null}
                    </View>
                    <View style={monitorStyles.discoveredItemText}>
                      <ThemedText
                        style={monitorStyles.discoveredName}
                        numberOfLines={1}
                      >
                        {device.displayName}
                      </ThemedText>
                      <ThemedText
                        style={monitorStyles.discoveredDeviceId}
                        numberOfLines={1}
                      >
                        {device.deviceId}
                      </ThemedText>
                    </View>
                    <ThemedText
                      style={[
                        monitorStyles.connectHint,
                        { color: Colors[theme].tint },
                      ]}
                    >
                      Connetti
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ThemedView>
          )}

          {foundDeviceName && discoveredDevices.length === 0 && (
            <ThemedView style={monitorStyles.successMessage}>
              <ThemedText style={monitorStyles.successText}>
                ✅ Trovato device {foundDeviceName} (
                {isSupportedMuseDevice(foundDeviceName)
                  ? getMuseProductBadge(foundDeviceName)
                  : getPolarProductBadge(foundDeviceName)}
                )
              </ThemedText>
            </ThemedView>
          )}
        </>
      ) : (
        <View style={monitorStyles.connectedButtons}>
          <TouchableOpacity
            style={[monitorStyles.button, monitorStyles.disconnectButton]}
            onPress={onDisconnect}
          >
            <ThemedText style={monitorStyles.buttonText}>
              {disconnectButtonLabel}
            </ThemedText>
          </TouchableOpacity>
          {debugMode && (
            <TouchableOpacity
              style={[
                monitorStyles.button,
                monitorStyles.flushButton,
                { backgroundColor: Colors[theme].tint },
              ]}
              onPress={onFlushTrack}
              disabled={isFlushingTrack}
            >
              {isFlushingTrack ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={monitorStyles.buttonText}>
                  Simula endSession / Flush track
                </ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {authToken && debugMode && (
        <TouchableOpacity
          style={[monitorStyles.button, monitorStyles.clearButton]}
          onPress={onClearStoredAuth}
        >
          <View style={monitorStyles.buttonContent}>
            <Trash2 size={16} color="#fff" />
            <ThemedText style={monitorStyles.buttonText}>
              Cancella Token Salvato
            </ThemedText>
          </View>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}
