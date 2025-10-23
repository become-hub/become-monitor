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
     * Valida il token con il server per verificare che sia ancora attivo
     */
    async validateToken(deviceToken: string): Promise<boolean> {
        try {
            console.log("AuthService: Validating token with server...");

            // Usa lo stesso endpoint del polling per validare il token
            const response = await fetch(
                `${this.serverUrl}/auth/device/pool?deviceToken=${deviceToken}`
            );

            if (!response.ok) {
                console.log("AuthService: Token validation failed, response not ok");
                return false;
            }

            const bodyString = await response.text();
            const data = JSON.parse(bodyString);

            // Il token è valido se authenticated è true
            const isValid = data.authenticated === true;
            console.log(`AuthService: Token validation result: ${isValid}`);

            return isValid;
        } catch (error) {
            console.error("AuthService: Error validating token", error);
            return false;
        }
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
            console.log("AuthService: Found stored auth data, validating with server...");

            // Valida il token con il server usando il deviceToken
            const isValid = await this.validateToken(storedData.deviceToken);

            if (isValid) {
                console.log("AuthService: Token is valid, using stored auth data");
                return {
                    needsAuth: false,
                    storedData
                };
            } else {
                console.log("AuthService: Token is invalid, clearing stored data and starting new auth flow");
                // Token non valido, cancella i dati salvati
                await this.clearAuthData();
            }
        }

        // Se non ci sono dati salvati o il token non è valido, avvia nuovo flusso di autenticazione
        console.log("AuthService: Starting new auth flow");
        const authResponse = await this.startDeviceAuth();

        return {
            needsAuth: true,
            newAuthResponse: authResponse || undefined
        };
    }

}

