import { create } from 'zustand';

interface SettingsState {
    debugMode: boolean;
    developerMode: boolean;

    // Actions
    setDebugMode: (debugMode: boolean) => void;
    setDeveloperMode: (developerMode: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    debugMode: false,
    developerMode: false,

    setDebugMode: (debugMode) => set({ debugMode }),
    setDeveloperMode: (developerMode) => set({ developerMode }),
}));

