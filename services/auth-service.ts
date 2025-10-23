/**
 * AuthService
 * Gestisce il flusso di autenticazione del dispositivo
 */

import { StorageService, StoredAuthData } from './storage-service';

export interface DeviceStartResponse {
    code: string;
    deviceToken: string;
    expiresAt: number;
}

export interface DevicePollResponse {
    authenticated: boolean;
    userId: string;
    session: string;
    deviceCode: string;
    appId?: string;
}

export class AuthService {
    private serverUrl = "https://staging-api25.become-hub.com";

    /**
     * Step 1: avvia il flusso di autenticazione del dispositivo
     */
    async startDeviceAuth(): Promise<DeviceStartResponse | null> {
        try {
            const response = await fetch(`${this.serverUrl}/auth/device/start`);

            if (!response.ok) {
                console.error("AuthService: startDeviceAuth failed", response.status);
                return null;
            }

            const data = await response.json();
            return {
                code: data.code,
                deviceToken: data.deviceToken,
                expiresAt: data.expiresAt,
            };
        } catch (error) {
            console.error("AuthService: startDeviceAuth error", error);
            return null;
        }
    }

    /**
     * Step 2: polling dell'endpoint di conferma fino a quando l'utente non effettua il login sul PC
     */
    async pollDeviceAuth(deviceToken: string): Promise<DevicePollResponse | null> {
        try {
            console.log("AuthService: pollDeviceAuth chiamato con deviceToken:", deviceToken);

            const response = await fetch(
                `${this.serverUrl}/auth/device/pool?deviceToken=${deviceToken}`
            );

            console.log("AuthService: pollDeviceAuth response status:", response.status, deviceToken);
            console.log("AuthService: pollDeviceAuth response ok:", response.ok);

            const bodyString = await response.text();
            console.log("AuthService: pollDeviceAuth raw response:", bodyString);

            if (!response.ok) {
                console.log("AuthService: pollDeviceAuth response not ok, status:", response.status);
                return null;
            }

            const data = JSON.parse(bodyString);
            console.log("AuthService: pollDeviceAuth parsed data:", data);
            console.log("AuthService: pollDeviceAuth data.authenticated:", data.authenticated);
            console.log("AuthService: pollDeviceAuth data.authenticated type:", typeof data.authenticated);

            const result = {
                authenticated: data.authenticated ?? false,
                userId: data.userId ?? "",
                session: data.session ?? "",
                deviceCode: data.deviceCode ?? "",
            };

            console.log("AuthService: pollDeviceAuth returning:", result);
            console.log("AuthService: pollDeviceAuth result.authenticated:", result.authenticated);
            console.log("AuthService: pollDeviceAuth result.authenticated type:", typeof result.authenticated);
            return result;
        } catch (error) {
            console.error("AuthService: pollDeviceAuth error", error);
            return null;
        }
    }

    /**
     * Controlla se ci sono dati di autenticazione salvati e validi
     */
    async getStoredAuthData(): Promise<StoredAuthData | null> {
        return await StorageService.getAuthData();
    }

    /**
     * Salva i dati di autenticazione completati
     */
    async saveAuthData(authData: StoredAuthData): Promise<void> {
        await StorageService.saveAuthData(authData);
    }

    /**
     * Cancella i dati di autenticazione salvati
     */
    async clearAuthData(): Promise<void> {
        await StorageService.clearAuthData();
    }

    /**
     * Avvia il flusso di autenticazione con controllo token salvato
     */
    async startAuthFlow(): Promise<{
        needsAuth: boolean;
        storedData?: StoredAuthData;
        newAuthResponse?: DeviceStartResponse;
    }> {
        // Prima controlla se abbiamo dati salvati validi
        const storedData = await this.getStoredAuthData();
        if (storedData) {
            console.log("AuthService: Found valid stored auth data");
            return {
                needsAuth: false,
                storedData
            };
        }

        // Se non ci sono dati salvati, avvia nuovo flusso di autenticazione
        console.log("AuthService: No stored auth data, starting new auth flow");
        const authResponse = await this.startDeviceAuth();

        return {
            needsAuth: true,
            newAuthResponse: authResponse || undefined
        };
    }

}

