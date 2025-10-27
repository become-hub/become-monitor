/**
 * Test per Storage Service
 * Verifica la gestione dello storage dei token di autenticazione
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService, StoredAuthData } from '../storage-service';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

describe('StorageService', () => {
    const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('saveAuthData', () => {
        it('salva correttamente i dati di autenticazione', async () => {
            const authData: StoredAuthData = {
                authToken: 'test-token',
                userId: 123,
                deviceCode: 'device-abc',
                expiresAt: Date.now() / 1000 + 3600, // 1 ora nel futuro
                deviceName: 'Polar H10',
                deviceId: 'polar-device-123'
            };

            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await StorageService.saveAuthData(authData);

            expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
                'auth_data',
                JSON.stringify(authData)
            );
        });

        it('gestisce errori durante il salvataggio', async () => {
            const authData: StoredAuthData = {
                authToken: 'test-token',
                userId: 123,
                deviceCode: 'device-abc',
                expiresAt: Date.now() / 1000 + 3600,
                deviceName: 'Polar H10',
                deviceId: 'polar-device-123'
            };

            mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

            // Non dovrebbe lanciare eccezioni
            await expect(StorageService.saveAuthData(authData)).resolves.toBeUndefined();
        });
    });

    describe('getAuthData', () => {
        it('restituisce i dati salvati se validi', async () => {
            const authData: StoredAuthData = {
                authToken: 'test-token',
                userId: 123,
                deviceCode: 'device-abc',
                expiresAt: Date.now() / 1000 + 3600, // 1 ora nel futuro
                deviceName: 'Polar H10',
                deviceId: 'polar-device-123'
            };

            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(authData));

            const result = await StorageService.getAuthData();

            expect(result).toEqual(authData);
            expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('auth_data');
        });

        it('restituisce null se non ci sono dati salvati', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await StorageService.getAuthData();

            expect(result).toBeNull();
        });

        it('rimuove i dati se scaduti', async () => {
            const expiredAuthData: StoredAuthData = {
                authToken: 'test-token',
                userId: 123,
                deviceCode: 'device-abc',
                expiresAt: Date.now() / 1000 - 3600, // 1 ora nel passato
                deviceName: 'Polar H10',
                deviceId: 'polar-device-123'
            };

            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(expiredAuthData));
            mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

            const result = await StorageService.getAuthData();

            expect(result).toBeNull();
            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_data');
        });

        it('gestisce errori durante il recupero', async () => {
            mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

            const result = await StorageService.getAuthData();

            expect(result).toBeNull();
        });
    });

    describe('clearAuthData', () => {
        it('cancella tutti i dati di autenticazione', async () => {
            mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);
            mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

            await StorageService.clearAuthData();

            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('auth_data');
            expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('device_token');
        });
    });

    describe('saveDeviceToken e getDeviceToken', () => {
        it('salva e recupera il device token', async () => {
            const token = 'device-token-123';

            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);
            mockAsyncStorage.getItem.mockResolvedValueOnce(token);

            await StorageService.saveDeviceToken(token);
            const result = await StorageService.getDeviceToken();

            expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('device_token', token);
            expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('device_token');
            expect(result).toBe(token);
        });

        it('restituisce null se il device token non esiste', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            const result = await StorageService.getDeviceToken();

            expect(result).toBeNull();
        });
    });

    describe('updateDeviceName', () => {
        it('aggiorna il nome del dispositivo nei dati esistenti', async () => {
            const existingData: StoredAuthData = {
                authToken: 'test-token',
                userId: 123,
                deviceCode: 'device-abc',
                expiresAt: Date.now() / 1000 + 3600,
                deviceName: 'Polar H10',
                deviceId: 'polar-device-123'
            };

            const newDeviceName = 'Polar H9';

            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingData));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await StorageService.updateDeviceName(newDeviceName);

            expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
                'auth_data',
                JSON.stringify({ ...existingData, deviceName: newDeviceName })
            );
        });

        it('non fa nulla se non ci sono dati salvati', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            await StorageService.updateDeviceName('New Device');

            expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('updateDeviceId', () => {
        it('aggiorna l\'ID del dispositivo nei dati esistenti', async () => {
            const existingData: StoredAuthData = {
                authToken: 'test-token',
                userId: 123,
                deviceCode: 'device-abc',
                expiresAt: Date.now() / 1000 + 3600,
                deviceName: 'Polar H10',
                deviceId: 'polar-device-123'
            };

            const newDeviceId = 'polar-device-456';

            mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingData));
            mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

            await StorageService.updateDeviceId(newDeviceId);

            expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
                'auth_data',
                JSON.stringify({ ...existingData, deviceId: newDeviceId })
            );
        });

        it('non fa nulla se non ci sono dati salvati', async () => {
            mockAsyncStorage.getItem.mockResolvedValueOnce(null);

            await StorageService.updateDeviceId('new-device-id');

            expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
        });
    });
});
