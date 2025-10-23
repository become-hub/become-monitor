/**
 * AblyService
 * Gestisce la connessione e l'invio di messaggi tramite Ably
 */

import * as Ably from "ably";

export enum ConnectionStatus {
    CONNECTED = "CONNECTED",
    CONNECTING = "CONNECTING",
    DISCONNECTED = "DISCONNECTED",
}

export class AblyService {
    private ably: Ably.Realtime | null = null;
    private isConnected = false;
    private presenceEntered = false;
    private ablyTokenEndpoint: string;
    private connectionStatusCallback: (status: ConnectionStatus) => void;

    constructor(
        ablyTokenEndpoint: string,
        connectionStatusCallback: (status: ConnectionStatus) => void
    ) {
        this.ablyTokenEndpoint = ablyTokenEndpoint;
        this.connectionStatusCallback = connectionStatusCallback;
    }

    connectWithToken(authToken: string, userId: number, deviceCode: string) {
        console.log(`AblyService: 🚀 Connecting to Ably with token - userId: ${userId} (type: ${typeof userId}), deviceCode: ${deviceCode}`);

        this.ably = new Ably.Realtime({
            authUrl: this.ablyTokenEndpoint,
            authHeaders: {
                Authorization: `Bearer ${authToken}`,
            },
        });

        this.setupConnectionListener(userId, deviceCode);
    }

    private setupConnectionListener(userId: number, deviceCode: string) {
        if (!this.ably) return;

        this.ably.connection.on((stateChange) => {
            switch (stateChange.current) {
                case "connecting":
                    this.isConnected = false;
                    console.log("AblyService: ⏳ Connecting...");
                    this.connectionStatusCallback(ConnectionStatus.CONNECTING);
                    break;

                case "connected":
                    this.isConnected = true;
                    console.log("AblyService: ✅ Connected!");
                    this.connectionStatusCallback(ConnectionStatus.CONNECTED);

                    // Entra in presenza solo una volta per connessione
                    if (!this.presenceEntered && this.ably) {
                        this.presenceEntered = true; // Imposta subito per evitare chiamate multiple
                        const channel = this.ably.channels.get(`private:${userId}`);
                        channel.presence.enter(
                            JSON.stringify({ deviceCode })
                        ).then(() => {
                            console.log(
                                "AblyService: 🤝 Presence entered once:",
                                deviceCode
                            );
                        }).catch((err: any) => {
                            console.error(
                                "AblyService: ❌ Presence error:",
                                err.message
                            );
                            this.presenceEntered = false; // Reset se errore
                        });
                    }
                    break;

                case "failed":
                case "disconnected":
                    this.isConnected = false;
                    this.presenceEntered = false; // Reset quando disconnesso
                    console.error(
                        "AblyService: 🚫 Connection issue:",
                        stateChange.reason?.message
                    );
                    this.connectionStatusCallback(ConnectionStatus.DISCONNECTED);
                    break;

                default:
                    console.log("AblyService: 🔄 Event:", stateChange.current);
            }
        });
    }

    sendHeartRate(
        deviceCode: string,
        userId: number,
        bpm: number,
        hrv: number,
        lf: number,
        hf: number
    ) {
        console.log(`AblyService: 🔍 Connection check - ably: ${!!this.ably}, isConnected: ${this.isConnected}`);
        if (!this.ably || !this.isConnected) {
            console.warn("AblyService: ⚠️ Cannot send, not connected");
            console.warn(`AblyService: 🔍 Details - ably exists: ${!!this.ably}, isConnected: ${this.isConnected}`);
            return;
        }

        try {
            console.log(`AblyService: 🔍 Debug - Received userId: ${userId} (type: ${typeof userId}), deviceCode: ${deviceCode}`);
            const channelName = `private:${userId}`;
            console.log(`AblyService: 🔍 Channel name: ${channelName}`);
            const channel = this.ably.channels.get(channelName);

            const message = {
                heartRate: bpm,
                hrv: hrv,
                lf: lf,
                hf: hf,
                code: deviceCode,
                type: "private_msg",
            };

            channel.publish("heartRate", JSON.stringify(message));
            console.log(`AblyService: 📨 Sent heartRate=${bpm} to private:${userId}`);
        } catch (error: any) {
            console.error("AblyService: ❌ Failed to send heart rate:", error.message);
        }
    }

    /**
     * Metodo generico per inviare messaggi ad Ably
     */
    sendMessage(
        userId: number,
        eventType: string,
        data: any,
        deviceCode?: string
    ) {
        if (!this.ably || !this.isConnected) {
            console.warn("AblyService: ⚠️ Cannot send message, not connected");
            return;
        }

        try {
            const channel = this.ably.channels.get(`private:${userId}`);

            const message = {
                ...data,
                type: eventType,
                code: deviceCode,
                timestamp: new Date().toISOString(),
            };

            channel.publish(eventType, JSON.stringify(message));
            console.log(`AblyService: 📨 Sent ${eventType} to private:${userId}:`, data);
        } catch (error: any) {
            console.error(`AblyService: ❌ Failed to send ${eventType}:`, error.message);
        }
    }

    close() {
        if (this.ably) {
            this.ably.close();
            console.log("AblyService: 🔒 Connection closed");
            this.ably = null;
            this.isConnected = false;
            this.presenceEntered = false;
        }
    }
}

