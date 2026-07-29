import { create } from "zustand";

import type { MuseProductId } from "@/services/muse-products";
import type { PolarProductId } from "@/services/polar-products";

export type DiscoveredDeviceFamily = "polar" | "muse";

export interface DiscoveredDevice {
  deviceId: string;
  name: string;
  family: DiscoveredDeviceFamily;
  /** Polar catalog id or Muse catalog id (e.g. polar_h10, muse_2). */
  productId: PolarProductId | MuseProductId;
  displayName: string;
}

/** @deprecated Use DiscoveredDevice — kept as alias for Polar-only call sites. */
export type DiscoveredPolarDevice = DiscoveredDevice;

interface ScanState {
  isScanning: boolean;
  deviceFoundDuringScan: boolean;
  scanStartTime: number | null;
  connectedDeviceId: string | null;
  discoveredDevices: DiscoveredDevice[];

  setScanning: (value: boolean) => void;
  setDeviceFound: (value: boolean) => void;
  setScanStartTime: (time: number | null) => void;
  setConnectedDeviceId: (deviceId: string | null) => void;
  upsertDiscoveredDevice: (device: DiscoveredDevice) => void;
  clearDiscoveredDevices: () => void;
  resetScanState: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  isScanning: false,
  deviceFoundDuringScan: false,
  scanStartTime: null,
  connectedDeviceId: null,
  discoveredDevices: [],

  setScanning: (value) => set({ isScanning: value }),
  setDeviceFound: (value) => set({ deviceFoundDuringScan: value }),
  setScanStartTime: (time) => set({ scanStartTime: time }),
  setConnectedDeviceId: (deviceId) => set({ connectedDeviceId: deviceId }),
  upsertDiscoveredDevice: (device) =>
    set((state) => {
      const exists = state.discoveredDevices.some(
        (d) => d.deviceId === device.deviceId
      );
      if (exists) {
        return {
          discoveredDevices: state.discoveredDevices.map((d) =>
            d.deviceId === device.deviceId ? device : d
          ),
        };
      }
      return {
        discoveredDevices: [...state.discoveredDevices, device],
      };
    }),
  clearDiscoveredDevices: () => set({ discoveredDevices: [] }),

  resetScanState: () =>
    set({
      isScanning: false,
      deviceFoundDuringScan: false,
      scanStartTime: null,
      connectedDeviceId: null,
      discoveredDevices: [],
    }),
}));
