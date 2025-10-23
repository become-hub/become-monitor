/**
 * Storage Service
 * Gestisce lo storage sicuro dei token e dati di autenticazione
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredAuthData {
    authToken: string;
    userId: number;
    deviceCode: string;
    deviceToken: string; // Token per validazione
    expiresAt: number;
    deviceName?: string;
    deviceId?: string;
    appId?: string;
}

export class StorageService {
    private static readonly AUTH_DATA_KEY = 'auth_data';
    private static readonly DEVICE_TOKEN_KEY = 'device_token';

    /**
     * Salva i dati di autenticazione completati
     */
    static async saveAuthData(data: StoredAuthData): Promise<void> {
        try {
            await AsyncStorage.setItem(this.AUTH_DATA_KEY, JSON.stringify(data));
            console.log('StorageService: Auth data saved successfully');
        } catch (error) {
            console.error('StorageService: Error saving auth data:', error);
        }
    }

    /**
     * Recupera i dati di autenticazione salvati
     */
    static async getAuthData(): Promise<StoredAuthData | null> {
        try {
            const data = await AsyncStorage.getItem(this.AUTH_DATA_KEY);
            if (data) {
                const parsedData = JSON.parse(data) as StoredAuthData;

                // Controlla se il token è ancora valido
                const now = Math.floor(Date.now() / 1000);
                if (parsedData.expiresAt > now) {
                    console.log('StorageService: Valid auth data found');
                    return parsedData;
                } else {
                    console.log('StorageService: Auth data expired, removing...');
                    await this.clearAuthData();
                    return null;
                }
            }
            return null;
        } catch (error) {
            console.error('StorageService: Error retrieving auth data:', error);
            return null;
        }
    }

    /**
     * Cancella i dati di autenticazione salvati
     */
    static async clearAuthData(): Promise<void> {
        try {
            await AsyncStorage.removeItem(this.AUTH_DATA_KEY);
            await AsyncStorage.removeItem(this.DEVICE_TOKEN_KEY);
            console.log('StorageService: Auth data cleared');
        } catch (error) {
            console.error('StorageService: Error clearing auth data:', error);
        }
    }

    /**
     * Salva il device token temporaneo
     */
    static async saveDeviceToken(deviceToken: string): Promise<void> {
        try {
            await AsyncStorage.setItem(this.DEVICE_TOKEN_KEY, deviceToken);
            console.log('StorageService: Device token saved');
        } catch (error) {
            console.error('StorageService: Error saving device token:', error);
        }
    }

    /**
     * Recupera il device token temporaneo
     */
    static async getDeviceToken(): Promise<string | null> {
        try {
            const token = await AsyncStorage.getItem(this.DEVICE_TOKEN_KEY);
            return token;
        } catch (error) {
            console.error('StorageService: Error retrieving device token:', error);
            return null;
        }
    }

    /**
     * Aggiorna solo il nome del dispositivo nei dati salvati
     */
    static async updateDeviceName(deviceName: string): Promise<void> {
        try {
            const existingData = await this.getAuthData();
            if (existingData) {
                existingData.deviceName = deviceName;
                await this.saveAuthData(existingData);
                console.log('StorageService: Device name updated:', deviceName);
            }
        } catch (error) {
            console.error('StorageService: Error updating device name:', error);
        }
    }

    /**
     * Aggiorna l'ID del dispositivo nei dati salvati
     */
    static async updateDeviceId(deviceId: string): Promise<void> {
        try {
            const existingData = await this.getAuthData();
            if (existingData) {
                existingData.deviceId = deviceId;
                await this.saveAuthData(existingData);
                console.log('StorageService: Device ID updated:', deviceId);
            }
        } catch (error) {
            console.error('StorageService: Error updating device ID:', error);
        }
    }
}
