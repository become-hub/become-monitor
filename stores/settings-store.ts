import { create } from "zustand";

export type PolarLiveRateHz = 1 | 4;

interface SettingsState {
  debugMode: boolean;
  developerMode: boolean;
  /** Monitor + Ably heartRate publish rate. Default 1 Hz; 4 Hz reserved (UI disabled). */
  polarLiveRateHz: PolarLiveRateHz;

  setDebugMode: (debugMode: boolean) => void;
  setDeveloperMode: (developerMode: boolean) => void;
  setPolarLiveRateHz: (rate: PolarLiveRateHz) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  debugMode: false,
  developerMode: false,
  polarLiveRateHz: 1,

  setDebugMode: (debugMode) => set({ debugMode }),
  setDeveloperMode: (developerMode) => set({ developerMode }),
  setPolarLiveRateHz: (polarLiveRateHz) => set({ polarLiveRateHz }),
}));
