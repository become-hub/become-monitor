import { create } from 'zustand';

interface ScanState {
    isScanning: boolean;
    deviceFoundDuringScan: boolean;
    scanStartTime: number | null;
    connectedDeviceId: string | null;

    // Actions
    setScanning: (value: boolean) => void;
    setDeviceFound: (value: boolean) => void;
    setScanStartTime: (time: number | null) => void;
    setConnectedDeviceId: (deviceId: string | null) => void;
    resetScanState: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
    isScanning: false,
    deviceFoundDuringScan: false,
    scanStartTime: null,
    connectedDeviceId: null,

    setScanning: (value) => set({ isScanning: value }),
    setDeviceFound: (value) => set({ deviceFoundDuringScan: value }),
    setScanStartTime: (time) => set({ scanStartTime: time }),
    setConnectedDeviceId: (deviceId) => set({ connectedDeviceId: deviceId }),

    resetScanState: () => set({
        isScanning: false,
        deviceFoundDuringScan: false,
        scanStartTime: null,
        connectedDeviceId: null,
    }),
}));

