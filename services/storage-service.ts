/**
 * Storage Service
 * Gestisce lo storage sicuro dei token e dati di autenticazione per device.
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

type AuthSessionsMap = Record<string, StoredAuthData>;
type DeviceTokensMap = Record<string, string>;

export class StorageService {
    private static readonly AUTH_DATA_KEY = 'auth_data';
    private static readonly DEVICE_TOKEN_KEY = 'device_token';
    private static readonly AUTH_SESSIONS_KEY = 'auth_sessions';
    private static readonly DEVICE_TOKENS_KEY = 'device_tokens';
    private static readonly LAST_DEVICE_ID_KEY = 'last_device_id';

    private static isExpired(data: StoredAuthData): boolean {
        const now = Math.floor(Date.now() / 1000);
        return data.expiresAt <= now;
    }

    private static async readSessions(): Promise<AuthSessionsMap> {
        await this.migrateLegacyAuthIfNeeded();
        try {
            const raw = await AsyncStorage.getItem(this.AUTH_SESSIONS_KEY);
            if (!raw) {
                return {};
            }
            return JSON.parse(raw) as AuthSessionsMap;
        } catch (error) {
            console.error('StorageService: Error reading auth sessions:', error);
            return {};
        }
    }

    private static async writeSessions(sessions: AuthSessionsMap): Promise<void> {
        await AsyncStorage.setItem(this.AUTH_SESSIONS_KEY, JSON.stringify(sessions));
    }

    private static async readDeviceTokens(): Promise<DeviceTokensMap> {
        await this.migrateLegacyAuthIfNeeded();
        try {
            const raw = await AsyncStorage.getItem(this.DEVICE_TOKENS_KEY);
            if (!raw) {
                return {};
            }
            return JSON.parse(raw) as DeviceTokensMap;
        } catch (error) {
            console.error('StorageService: Error reading device tokens:', error);
            return {};
        }
    }

    private static async writeDeviceTokens(tokens: DeviceTokensMap): Promise<void> {
        await AsyncStorage.setItem(this.DEVICE_TOKENS_KEY, JSON.stringify(tokens));
    }

    /**
     * Migra auth_data / device_token legacy → mappe per deviceId.
     */
    static async migrateLegacyAuthIfNeeded(): Promise<void> {
        try {
            const legacyAuth = await AsyncStorage.getItem(this.AUTH_DATA_KEY);
            const legacyToken = await AsyncStorage.getItem(this.DEVICE_TOKEN_KEY);

            if (!legacyAuth && !legacyToken) {
                return;
            }

            let sessions: AuthSessionsMap = {};
            const existingSessions = await AsyncStorage.getItem(this.AUTH_SESSIONS_KEY);
            if (existingSessions) {
                sessions = JSON.parse(existingSessions) as AuthSessionsMap;
            }

            let tokens: DeviceTokensMap = {};
            const existingTokens = await AsyncStorage.getItem(this.DEVICE_TOKENS_KEY);
            if (existingTokens) {
                tokens = JSON.parse(existingTokens) as DeviceTokensMap;
            }

            if (legacyAuth) {
                const parsed = JSON.parse(legacyAuth) as StoredAuthData;
                if (parsed.deviceId) {
                    sessions[parsed.deviceId] = parsed;
                    await AsyncStorage.setItem(this.LAST_DEVICE_ID_KEY, parsed.deviceId);
                    if (parsed.deviceToken) {
                        tokens[parsed.deviceId] = parsed.deviceToken;
                    }
                } else {
                    // Senza deviceId resta in legacy finché non viene aggiornato
                    return;
                }
            }

            if (legacyToken) {
                const lastId = await AsyncStorage.getItem(this.LAST_DEVICE_ID_KEY);
                if (lastId && !tokens[lastId]) {
                    tokens[lastId] = legacyToken;
                }
            }

            await AsyncStorage.setItem(this.AUTH_SESSIONS_KEY, JSON.stringify(sessions));
            await AsyncStorage.setItem(this.DEVICE_TOKENS_KEY, JSON.stringify(tokens));
            await AsyncStorage.removeItem(this.AUTH_DATA_KEY);
            await AsyncStorage.removeItem(this.DEVICE_TOKEN_KEY);
            console.log('StorageService: Migrated legacy auth to per-device sessions');
        } catch (error) {
            console.error('StorageService: Legacy auth migration failed:', error);
        }
    }

    static async setLastDeviceId(deviceId: string): Promise<void> {
        try {
            await AsyncStorage.setItem(this.LAST_DEVICE_ID_KEY, deviceId);
        } catch (error) {
            console.error('StorageService: Error saving last device id:', error);
        }
    }

    static async getLastDeviceId(): Promise<string | null> {
        try {
            await this.migrateLegacyAuthIfNeeded();
            return await AsyncStorage.getItem(this.LAST_DEVICE_ID_KEY);
        } catch (error) {
            console.error('StorageService: Error reading last device id:', error);
            return null;
        }
    }

    static async saveAuthDataForDevice(
        deviceId: string,
        data: StoredAuthData
    ): Promise<void> {
        try {
            const sessions = await this.readSessions();
            const payload: StoredAuthData = { ...data, deviceId };
            sessions[deviceId] = payload;
            await this.writeSessions(sessions);
            await this.setLastDeviceId(deviceId);
            if (payload.deviceToken) {
                await this.saveDeviceTokenForDevice(deviceId, payload.deviceToken);
            }
            console.log('StorageService: Auth data saved for device', deviceId);
        } catch (error) {
            console.error('StorageService: Error saving auth data for device:', error);
        }
    }

    static async getAuthDataForDevice(deviceId: string): Promise<StoredAuthData | null> {
        try {
            const sessions = await this.readSessions();
            const data = sessions[deviceId];
            if (!data) {
                const legacy = await AsyncStorage.getItem(this.AUTH_DATA_KEY);
                if (legacy) {
                    const parsed = JSON.parse(legacy) as StoredAuthData;
                    if (
                        !this.isExpired(parsed) &&
                        (!parsed.deviceId || parsed.deviceId === deviceId)
                    ) {
                        return parsed;
                    }
                    if (this.isExpired(parsed)) {
                        await AsyncStorage.removeItem(this.AUTH_DATA_KEY);
                    }
                }
                return null;
            }
            if (this.isExpired(data)) {
                console.log('StorageService: Auth data expired for device', deviceId);
                await this.clearAuthDataForDevice(deviceId);
                return null;
            }
            return data;
        } catch (error) {
            console.error('StorageService: Error retrieving auth data for device:', error);
            return null;
        }
    }

    static async clearAuthDataForDevice(deviceId: string): Promise<void> {
        try {
            const sessions = await this.readSessions();
            delete sessions[deviceId];
            await this.writeSessions(sessions);

            const tokens = await this.readDeviceTokens();
            delete tokens[deviceId];
            await this.writeDeviceTokens(tokens);

            const lastId = await this.getLastDeviceId();
            if (lastId === deviceId) {
                await AsyncStorage.removeItem(this.LAST_DEVICE_ID_KEY);
            }
            console.log('StorageService: Auth data cleared for device', deviceId);
        } catch (error) {
            console.error('StorageService: Error clearing auth data for device:', error);
        }
    }

    static async saveDeviceTokenForDevice(
        deviceId: string,
        deviceToken: string
    ): Promise<void> {
        try {
            const tokens = await this.readDeviceTokens();
            tokens[deviceId] = deviceToken;
            await this.writeDeviceTokens(tokens);
            await this.setLastDeviceId(deviceId);
            console.log('StorageService: Device token saved for', deviceId);
        } catch (error) {
            console.error('StorageService: Error saving device token:', error);
        }
    }

    static async getDeviceTokenForDevice(deviceId: string): Promise<string | null> {
        try {
            const tokens = await this.readDeviceTokens();
            if (tokens[deviceId]) {
                return tokens[deviceId];
            }
            // Legacy single token while waiting for deviceId association
            return await AsyncStorage.getItem(this.DEVICE_TOKEN_KEY);
        } catch (error) {
            console.error('StorageService: Error retrieving device token:', error);
            return null;
        }
    }

    /**
     * Salva i dati di autenticazione (usa deviceId se presente).
     */
    static async saveAuthData(data: StoredAuthData): Promise<void> {
        try {
            if (data.deviceId) {
                await this.saveAuthDataForDevice(data.deviceId, data);
                return;
            }
            await AsyncStorage.setItem(this.AUTH_DATA_KEY, JSON.stringify(data));
            console.log('StorageService: Auth data saved successfully (legacy, no deviceId)');
        } catch (error) {
            console.error('StorageService: Error saving auth data:', error);
        }
    }

    /**
     * Recupera i dati di autenticazione dell'ultimo device, o legacy.
     */
    static async getAuthData(): Promise<StoredAuthData | null> {
        try {
            const lastId = await this.getLastDeviceId();
            if (lastId) {
                const perDevice = await this.getAuthDataForDevice(lastId);
                if (perDevice) {
                    return perDevice;
                }
            }

            const sessions = await this.readSessions();
            const ids = Object.keys(sessions);
            if (ids.length > 0) {
                const first = sessions[ids[0]];
                if (!this.isExpired(first)) {
                    return first;
                }
            }

            const data = await AsyncStorage.getItem(this.AUTH_DATA_KEY);
            if (data) {
                const parsedData = JSON.parse(data) as StoredAuthData;
                if (!this.isExpired(parsedData)) {
                    console.log('StorageService: Valid auth data found');
                    return parsedData;
                }
                console.log('StorageService: Auth data expired, removing...');
                await this.clearAuthData();
                return null;
            }
            return null;
        } catch (error) {
            console.error('StorageService: Error retrieving auth data:', error);
            return null;
        }
    }

    /**
     * Cancella tutte le sessioni (o un device se passato via clearAuthDataForDevice).
     */
    static async clearAuthData(): Promise<void> {
        try {
            await AsyncStorage.removeItem(this.AUTH_DATA_KEY);
            await AsyncStorage.removeItem(this.DEVICE_TOKEN_KEY);
            await AsyncStorage.removeItem(this.AUTH_SESSIONS_KEY);
            await AsyncStorage.removeItem(this.DEVICE_TOKENS_KEY);
            await AsyncStorage.removeItem(this.LAST_DEVICE_ID_KEY);
            console.log('StorageService: Auth data cleared');
        } catch (error) {
            console.error('StorageService: Error clearing auth data:', error);
        }
    }

    static async saveDeviceToken(deviceToken: string): Promise<void> {
        try {
            const lastId = await this.getLastDeviceId();
            if (lastId) {
                await this.saveDeviceTokenForDevice(lastId, deviceToken);
                return;
            }
            await AsyncStorage.setItem(this.DEVICE_TOKEN_KEY, deviceToken);
            console.log('StorageService: Device token saved');
        } catch (error) {
            console.error('StorageService: Error saving device token:', error);
        }
    }

    static async getDeviceToken(): Promise<string | null> {
        try {
            const lastId = await this.getLastDeviceId();
            if (lastId) {
                const token = await this.getDeviceTokenForDevice(lastId);
                if (token) {
                    return token;
                }
            }
            const token = await AsyncStorage.getItem(this.DEVICE_TOKEN_KEY);
            return token;
        } catch (error) {
            console.error('StorageService: Error retrieving device token:', error);
            return null;
        }
    }

    static async updateDeviceName(deviceName: string, deviceId?: string): Promise<void> {
        try {
            const targetId = deviceId || (await this.getLastDeviceId());
            if (targetId) {
                const existing = await this.getAuthDataForDevice(targetId);
                if (existing) {
                    existing.deviceName = deviceName;
                    await this.saveAuthDataForDevice(targetId, existing);
                    console.log('StorageService: Device name updated:', deviceName);
                }
                return;
            }
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

    static async updateDeviceId(deviceId: string): Promise<void> {
        try {
            await this.setLastDeviceId(deviceId);
            const existingForDevice = await this.getAuthDataForDevice(deviceId);
            if (existingForDevice) {
                existingForDevice.deviceId = deviceId;
                await this.saveAuthDataForDevice(deviceId, existingForDevice);
                await AsyncStorage.removeItem(this.AUTH_DATA_KEY);
                console.log('StorageService: Device ID updated:', deviceId);
                return;
            }

            const legacy = await AsyncStorage.getItem(this.AUTH_DATA_KEY);
            if (legacy) {
                const parsed = JSON.parse(legacy) as StoredAuthData;
                if (!this.isExpired(parsed)) {
                    parsed.deviceId = deviceId;
                    await this.saveAuthDataForDevice(deviceId, parsed);
                    await AsyncStorage.removeItem(this.AUTH_DATA_KEY);
                    console.log('StorageService: Device ID updated (from legacy):', deviceId);
                }
            }
        } catch (error) {
            console.error('StorageService: Error updating device id:', error);
        }
    }
}
