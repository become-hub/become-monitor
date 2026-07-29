/**
 * Muse BLE SDK Bridge
 * Interfaccia TypeScript per il modulo nativo MuseBleModule (GATT diretto).
 *
 * Event names are Muse-prefixed to avoid colliding with PolarBleModule on
 * RCTDeviceEventEmitter (shared global bus).
 */

import { NativeEventEmitter, NativeModules } from "react-native";

import { captureException } from "@/services/sentry";

const { MuseBleModule } = NativeModules;

export interface MuseDeviceInfo {
  deviceId: string;
  name: string;
  rssi?: number;
}

export interface MuseEegSample {
  tp9: number;
  af7: number;
  af8: number;
  tp10: number;
  sampleCount: number;
}

export interface MuseBandPowers {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
}

export interface MusePpgSample {
  ambient: number;
  infrared: number;
  red: number;
}

export interface MuseHrData {
  hr: number;
}

export interface MuseTelemetry {
  batteryPercent: number;
}

export type MuseEventType =
  | "onMuseDeviceFound"
  | "onMuseDeviceConnected"
  | "onMuseDeviceDisconnected"
  | "onMuseEegSample"
  | "onMuseBandPowers"
  | "onMusePpgSample"
  | "onMuseHeartRate"
  | "onMuseTelemetry"
  | "onMuseStreamError";

/** Log to Sentry then rethrow — does not swallow; callers keep existing control flow. */
async function withMuseSentry<T>(
  phase: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    captureException(error, { deviceFamily: "muse", phase });
    throw error;
  }
}

class MuseBleSdk {
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Map<string, { remove: () => void }> = new Map();

  private get emitter(): NativeEventEmitter {
    if (!MuseBleModule) {
      throw new Error("MuseBleModule is not available (native rebuild required)");
    }
    if (!this.eventEmitter) {
      this.eventEmitter = new NativeEventEmitter(MuseBleModule);
    }
    return this.eventEmitter;
  }

  private get native() {
    if (!MuseBleModule) {
      throw new Error("MuseBleModule is not available (native rebuild required)");
    }
    return MuseBleModule;
  }

  async startScan(): Promise<void> {
    return withMuseSentry("muse_start_scan", () => this.native.startScan());
  }

  async stopScan(): Promise<void> {
    return withMuseSentry("muse_stop_scan", () => this.native.stopScan());
  }

  async connectToDevice(deviceId: string): Promise<void> {
    return withMuseSentry("muse_connect", () =>
      this.native.connectToDevice(deviceId)
    );
  }

  async disconnectFromDevice(deviceId: string): Promise<void> {
    return withMuseSentry("muse_disconnect", () =>
      this.native.disconnectFromDevice(deviceId)
    );
  }

  async startEegStreaming(): Promise<void> {
    return withMuseSentry("muse_start_eeg", () =>
      this.native.startEegStreaming()
    );
  }

  async startPpgStreaming(): Promise<void> {
    return withMuseSentry("muse_start_ppg", () =>
      this.native.startPpgStreaming()
    );
  }

  async stopStreaming(): Promise<void> {
    return withMuseSentry("muse_stop_streaming", () =>
      this.native.stopStreaming()
    );
  }

  addEventListener(
    event: "onMuseDeviceFound",
    callback: (device: MuseDeviceInfo) => void
  ): void;
  addEventListener(
    event: "onMuseDeviceConnected",
    callback: (device: MuseDeviceInfo) => void
  ): void;
  addEventListener(
    event: "onMuseDeviceDisconnected",
    callback: (device: MuseDeviceInfo) => void
  ): void;
  addEventListener(
    event: "onMuseEegSample",
    callback: (data: MuseEegSample) => void
  ): void;
  addEventListener(
    event: "onMuseBandPowers",
    callback: (data: MuseBandPowers) => void
  ): void;
  addEventListener(
    event: "onMusePpgSample",
    callback: (data: MusePpgSample) => void
  ): void;
  addEventListener(
    event: "onMuseHeartRate",
    callback: (data: MuseHrData) => void
  ): void;
  addEventListener(
    event: "onMuseTelemetry",
    callback: (data: MuseTelemetry) => void
  ): void;
  addEventListener(
    event: "onMuseStreamError",
    callback: (error: { error: string }) => void
  ): void;
  addEventListener(event: MuseEventType, callback: (data: any) => void): void {
    const subscription = this.emitter.addListener(event, callback);
    this.listeners.set(event, subscription);
  }

  removeEventListener(event: MuseEventType): void {
    const subscription = this.listeners.get(event);
    if (subscription) {
      subscription.remove();
      this.listeners.delete(event);
    }
  }

  removeAllListeners(): void {
    this.listeners.forEach((subscription) => subscription.remove());
    this.listeners.clear();
  }
}

export const museSdk = new MuseBleSdk();
