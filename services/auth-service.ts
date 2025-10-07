/**
 * AuthService
 * Gestisce il flusso di autenticazione del dispositivo
 */

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
}

export class AuthService {
    private serverUrl = "https://production-api25.become-hub.com";

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
            const response = await fetch(
                `${this.serverUrl}/auth/device/pool?deviceToken=${deviceToken}`
            );

            const bodyString = await response.text();
            console.log("AuthService: pollDeviceAuth raw response:", bodyString);

            if (!response.ok) {
                return null;
            }

            const data = JSON.parse(bodyString);

            return {
                authenticated: data.authenticated ?? false,
                userId: data.userId ?? "",
                session: data.session ?? "",
                deviceCode: data.deviceCode ?? "",
            };
        } catch (error) {
            console.error("AuthService: pollDeviceAuth error", error);
            return null;
        }
    }
}

