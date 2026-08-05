/**
 * Test per Storage Service
 * Verifica la gestione dello storage dei token di autenticazione (anche multi-device)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService, StoredAuthData } from '../storage-service';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

describe('StorageService', () => {
    const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

    const futureAuth = (overrides: Partial<StoredAuthData> = {}): StoredAuthData => ({
        authToken: 'test-token',
        userId: 123,
        deviceCode: 'device-abc',
        deviceToken: 'device-token-xyz',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        deviceName: 'Polar 360',
        deviceId: 'polar-device-123',
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockAsyncStorage.getItem.mockResolvedValue(null);
        mockAsyncStorage.setItem.mockResolvedValue(undefined);
        mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    });

    describe('saveAuthDataForDevice / getAuthDataForDevice', () => {
        it('salva e recupera sessione per deviceId', async () => {
            const authData = futureAuth();
            const sessionsStore: Record<string, string> = {};

            mockAsyncStorage.getItem.mockImplementation(async (key) => {
                if (key === 'auth_sessions') {
                    return sessionsStore.auth_sessions ?? null;
                }
                if (key === 'device_tokens') {
                    return sessionsStore.device_tokens ?? null;
                }
                if (key === 'last_device_id') {
                    return sessionsStore.last_device_id ?? null;
                }
                return null;
            });
            mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
                sessionsStore[key] = value;
            });

            await StorageService.saveAuthDataForDevice('polar-device-123', authData);
            const result = await StorageService.getAuthDataForDevice('polar-device-123');

            expect(result).toEqual({ ...authData, deviceId: 'polar-device-123' });
            expect(sessionsStore.last_device_id).toBe('polar-device-123');
        });

        it('isolamento tra due device', async () => {
            const store: Record<string, string> = {};
            mockAsyncStorage.getItem.mockImplementation(async (key) => store[key] ?? null);
            mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
                store[key] = value;
            });
            mockAsyncStorage.removeItem.mockImplementation(async (key) => {
                delete store[key];
            });

            await StorageService.saveAuthDataForDevice(
                'device-a',
                futureAuth({ deviceId: 'device-a', authToken: 'token-a' })
            );
            await StorageService.saveAuthDataForDevice(
                'device-b',
                futureAuth({ deviceId: 'device-b', authToken: 'token-b' })
            );

            expect((await StorageService.getAuthDataForDevice('device-a'))?.authToken).toBe(
                'token-a'
            );
            expect((await StorageService.getAuthDataForDevice('device-b'))?.authToken).toBe(
                'token-b'
            );

            await StorageService.clearAuthDataForDevice('device-a');
            expect(await StorageService.getAuthDataForDevice('device-a')).toBeNull();
            expect((await StorageService.getAuthDataForDevice('device-b'))?.authToken).toBe(
                'token-b'
            );
        });
    });

    describe('migrazione legacy', () => {
        it('migra auth_data con deviceId verso auth_sessions', async () => {
            const legacy = futureAuth();
            const store: Record<string, string> = {
                auth_data: JSON.stringify(legacy),
            };

            mockAsyncStorage.getItem.mockImplementation(async (key) => store[key] ?? null);
            mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
                store[key] = value;
            });
            mockAsyncStorage.removeItem.mockImplementation(async (key) => {
                delete store[key];
            });

            const result = await StorageService.getAuthDataForDevice('polar-device-123');
            expect(result?.authToken).toBe('test-token');
            expect(store.auth_sessions).toBeTruthy();
            expect(store.auth_data).toBeUndefined();
        });
    });

    describe('saveAuthData / getAuthData (compat)', () => {
        it('salva tramite deviceId nella mappa sessioni', async () => {
            const store: Record<string, string> = {};
            mockAsyncStorage.getItem.mockImplementation(async (key) => store[key] ?? null);
            mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
                store[key] = value;
            });

            const authData = futureAuth();
            await StorageService.saveAuthData(authData);
            const result = await StorageService.getAuthData();

            expect(result?.deviceId).toBe('polar-device-123');
            expect(store.auth_sessions).toContain('polar-device-123');
        });

        it('restituisce null se non ci sono dati', async () => {
            const result = await StorageService.getAuthData();
            expect(result).toBeNull();
        });

        it('rimuove i dati se scaduti', async () => {
            const expired = futureAuth({
                expiresAt: Math.floor(Date.now() / 1000) - 3600,
            });
            const store: Record<string, string> = {
                auth_sessions: JSON.stringify({ 'polar-device-123': expired }),
                last_device_id: 'polar-device-123',
                device_tokens: JSON.stringify({ 'polar-device-123': 'tok' }),
            };
            mockAsyncStorage.getItem.mockImplementation(async (key) => store[key] ?? null);
            mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
                store[key] = value;
            });
            mockAsyncStorage.removeItem.mockImplementation(async (key) => {
                delete store[key];
            });

            const result = await StorageService.getAuthDataForDevice('polar-device-123');
            expect(result).toBeNull();
        });
    });

    describe('clearAuthData', () => {
        it('cancella tutte le chiavi auth', async () => {
            await StorageService.clearAuthData();

            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_data');
            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('device_token');
            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_sessions');
            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('device_tokens');
            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('last_device_id');
        });
    });

    describe('saveDeviceTokenForDevice', () => {
        it('salva e recupera token per device', async () => {
            const store: Record<string, string> = {};
            mockAsyncStorage.getItem.mockImplementation(async (key) => store[key] ?? null);
            mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
                store[key] = value;
            });

            await StorageService.saveDeviceTokenForDevice('dev-1', 'tok-1');
            const result = await StorageService.getDeviceTokenForDevice('dev-1');
            expect(result).toBe('tok-1');
        });
    });

    describe('updateDeviceName', () => {
        it('aggiorna il nome sul device indicato', async () => {
            const store: Record<string, string> = {};
            mockAsyncStorage.getItem.mockImplementation(async (key) => store[key] ?? null);
            mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
                store[key] = value;
            });

            await StorageService.saveAuthDataForDevice('polar-device-123', futureAuth());
            await StorageService.updateDeviceName('Polar Loop', 'polar-device-123');

            const result = await StorageService.getAuthDataForDevice('polar-device-123');
            expect(result?.deviceName).toBe('Polar Loop');
        });
    });

    describe('updateDeviceId', () => {
        it('imposta last device e migra legacy senza deviceId', async () => {
            const legacyNoId = futureAuth({ deviceId: undefined });
            const store: Record<string, string> = {
                auth_data: JSON.stringify(legacyNoId),
            };
            mockAsyncStorage.getItem.mockImplementation(async (key) => store[key] ?? null);
            mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
                store[key] = value;
            });
            mockAsyncStorage.removeItem.mockImplementation(async (key) => {
                delete store[key];
            });

            await StorageService.updateDeviceId('new-device-id');
            const result = await StorageService.getAuthDataForDevice('new-device-id');
            expect(result?.deviceId).toBe('new-device-id');
            expect(store.auth_data).toBeUndefined();
        });
    });
});


