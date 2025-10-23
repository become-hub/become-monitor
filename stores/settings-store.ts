import { create } from 'zustand';

interface SettingsState {
    debugMode: boolean;

    // Actions
    setDebugMode: (debugMode: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    debugMode: false,

    setDebugMode: (debugMode) => set({ debugMode }),
}));

