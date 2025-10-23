import { create } from 'zustand';

interface UserState {
    userId: number;
    deviceCode: string;
    authToken: string;
    authCode: string;
    appId: string;

    // Actions
    setUserId: (userId: number) => void;
    setDeviceCode: (deviceCode: string) => void;
    setAuthToken: (authToken: string) => void;
    setAuthCode: (authCode: string) => void;
    setAppId: (appId: string) => void;
    resetUserState: () => void;
}

export const useUserStore = create<UserState>((set) => ({
    userId: 0,
    deviceCode: '',
    authToken: '',
    authCode: '',
    appId: '',

    setUserId: (userId) => set({ userId }),
    setDeviceCode: (deviceCode) => set({ deviceCode }),
    setAuthToken: (authToken) => set({ authToken }),
    setAuthCode: (authCode) => set({ authCode }),
    setAppId: (appId) => set({ appId }),

    resetUserState: () => set({
        userId: 0,
        deviceCode: '',
        authToken: '',
        authCode: '',
        appId: '',
    }),
}));

