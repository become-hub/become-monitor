import { create } from "zustand";
import type { HrvAnalysisMode } from "@/features/hrv/core/hrv-analysis-mode";
import { useScanStore } from "@/stores/scan-store";

export type { HrvAnalysisMode };

interface SettingsState {
  debugMode: boolean;
  developerMode: boolean;
  /** Live (`client`) = short window; Estesa (`clinical`) = 5 min epoch. */
  hrvAnalysisMode: HrvAnalysisMode;
  /**
   * Bumped when Developer Mode invalidates Become tokens (e.g. from Settings).
   * Monitor watches this to re-request a 4-digit pairing code while BLE stays up.
   */
  authInvalidateNonce: number;

  setDebugMode: (debugMode: boolean) => void;
  setDeveloperMode: (developerMode: boolean) => void;
  setHrvAnalysisMode: (mode: HrvAnalysisMode) => void;
  bumpAuthInvalidate: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  debugMode: false,
  developerMode: false,
  hrvAnalysisMode: "client",
  authInvalidateNonce: 0,

  setDebugMode: (debugMode) => set({ debugMode }),
  setDeveloperMode: (developerMode) => set({ developerMode }),
  bumpAuthInvalidate: () =>
    set((state) => ({ authInvalidateNonce: state.authInvalidateNonce + 1 })),
  setHrvAnalysisMode: (hrvAnalysisMode) => {
    // Estesa (clinical) is not selectable yet — H10-only, coming later.
    if (hrvAnalysisMode === "clinical") {
      return;
    }
    // Locked while a device is connected (Settings UI also disables the switch).
    if (useScanStore.getState().connectedDeviceId) {
      return;
    }
    set({ hrvAnalysisMode });
  },
}));

// Guard against hot-reload / stale state leaving Estesa selected.
if (useSettingsStore.getState().hrvAnalysisMode === "clinical") {
  useSettingsStore.setState({ hrvAnalysisMode: "client" });
}
