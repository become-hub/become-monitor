import { create } from "zustand";
import type { HrvAnalysisMode } from "@/features/monitor/hooks/hrv-analysis-mode";
import { useScanStore } from "@/stores/scan-store";

export type { HrvAnalysisMode };

interface SettingsState {
  debugMode: boolean;
  developerMode: boolean;
  /** Live (`client`) = short window; Estesa (`clinical`) = 5 min epoch. */
  hrvAnalysisMode: HrvAnalysisMode;

  setDebugMode: (debugMode: boolean) => void;
  setDeveloperMode: (developerMode: boolean) => void;
  setHrvAnalysisMode: (mode: HrvAnalysisMode) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  debugMode: false,
  developerMode: false,
  hrvAnalysisMode: "client",

  setDebugMode: (debugMode) => set({ debugMode }),
  setDeveloperMode: (developerMode) => set({ developerMode }),
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
