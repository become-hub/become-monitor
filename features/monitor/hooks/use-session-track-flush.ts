/**
 * Session track flush helpers (pure). Used by useMonitorSession — do not call
 * useMonitorSession from here (would duplicate BLE listeners).
 */

import { Alert } from "react-native";
import type { PolarProduct } from "@/services/polar-products";
import { resolvePolarProduct } from "@/services/polar-products";
import {
  flushSessionTrack,
  startSessionOfflineRecording,
} from "@/services/session-track-flush";
import { sessionTrackBuffer } from "@/services/session-track-buffer";
import { useUserStore } from "@/stores/user-store";

export type TrackNotification = {
  type: "success" | "error";
  message: string;
};

export async function beginOfflineTrackForDevice(
  deviceId: string,
  product: PolarProduct | null | undefined,
  connectedDeviceName: string,
  setOfflineRecordingStarted: (v: boolean) => void,
  setNotification: (n: TrackNotification | null) => void
): Promise<void> {
  const resolvedProduct =
    product ?? resolvePolarProduct(connectedDeviceName);
  if (resolvedProduct && !resolvedProduct.capabilities.ppi) {
    sessionTrackBuffer.clear();
    setOfflineRecordingStarted(false);
    setNotification({
      type: "success",
      message: "Buffer live attivo (RR ECG)",
    });
    setTimeout(() => setNotification(null), 5000);
    return;
  }

  const result = await startSessionOfflineRecording(deviceId);
  setOfflineRecordingStarted(result.started);
  if (result.started) {
    setNotification({
      type: "success",
      message: "Offline PPI recording avviato sul Polar",
    });
  } else {
    setNotification({
      type: "success",
      message: "Offline recording non disponibile — buffer live attivo",
    });
  }
  setTimeout(() => setNotification(null), 5000);
}

export async function flushMonitorTrack(options: {
  deviceId: string | null;
  connectedDeviceName: string;
  sessionId?: string | null;
  flushInFlightRef: { current: boolean };
  setIsFlushingTrack: (v: boolean) => void;
  setOfflineRecordingStarted: (v: boolean) => void;
  setNotification: (n: TrackNotification | null) => void;
}): Promise<void> {
  const {
    deviceId,
    connectedDeviceName,
    sessionId,
    flushInFlightRef,
    setIsFlushingTrack,
    setOfflineRecordingStarted,
    setNotification,
  } = options;

  if (!deviceId) {
    Alert.alert("Flush track", "Nessun dispositivo connesso.");
    return;
  }
  if (flushInFlightRef.current) {
    return;
  }
  flushInFlightRef.current = true;
  setIsFlushingTrack(true);
  try {
    const userState = useUserStore.getState();
    const product = resolvePolarProduct(connectedDeviceName);
    const result = await flushSessionTrack({
      deviceId,
      deviceCode: userState.deviceCode || undefined,
      userId: userState.userId || undefined,
      authToken: userState.authToken || undefined,
      sessionId: sessionId ?? null,
      skipOfflinePpi: product?.capabilities.ppi === false,
    });
    setOfflineRecordingStarted(false);
    setNotification({
      type: "success",
      message: result.dryRun
        ? `Track flushed (dry-run) · ${result.sampleCount} sample · ${result.source}`
        : `Track uploaded · ${result.sampleCount} sample · ${result.source}`,
    });
    setTimeout(() => setNotification(null), 8000);
  } catch (error: any) {
    console.error("Monitor: flush track failed", error);
    Alert.alert(
      "Flush track fallito",
      error?.message || "Errore sconosciuto"
    );
  } finally {
    flushInFlightRef.current = false;
    setIsFlushingTrack(false);
  }
}
