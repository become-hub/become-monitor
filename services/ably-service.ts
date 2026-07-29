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

export type EndSessionPayload = {
    sessionId?: string | null;
    [key: string]: unknown;
};

export type EndSessionHandler = (payload: EndSessionPayload) => void;

export class AblyService {
    private ably: Ably.Realtime | null = null;
    private isConnected = false;
    private presenceEntered = false;
    private connectedUserId: number | null = null;
    private connectedDeviceCode: string | null = null;
    private ablyTokenEndpoint: string;
    private connectionStatusCallback: (status: ConnectionStatus) => void;
    private endSessionHandler: EndSessionHandler | null = null;
    private endSessionSubscribedUserId: number | null = null;

    constructor(
        ablyTokenEndpoint: string,
        connectionStatusCallback: (status: ConnectionStatus) => void
    ) {
        this.ablyTokenEndpoint = ablyTokenEndpoint;
        this.connectionStatusCallback = connectionStatusCallback;
    }

    setEndSessionHandler(handler: EndSessionHandler | null) {
        this.endSessionHandler = handler;
        if (this.isConnected && this.connectedUserId != null) {
            this.subscribeEndSession(this.connectedUserId);
        }
    }

    connectWithToken(authToken: string, userId: number, deviceCode: string) {
        console.log(`AblyService: 🚀 Connecting to Ably with token - userId: ${userId} (type: ${typeof userId}), deviceCode: ${deviceCode}`);

        // Idempotent: avoid spawning orphan Realtime instances (presence / lock thrash).
        if (
            this.ably &&
            this.isConnected &&
            this.connectedUserId === userId &&
            this.connectedDeviceCode === deviceCode
        ) {
            console.log("AblyService: ⏭️ Already connected for same user/device — skip");
            return;
        }

        if (this.ably) {
            this.ably.close();
            this.ably = null;
            this.isConnected = false;
            this.presenceEntered = false;
            this.endSessionSubscribedUserId = null;
            this.connectedUserId = null;
            this.connectedDeviceCode = null;
        }

        this.connectedUserId = userId;
        this.connectedDeviceCode = deviceCode;
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
                    console.log("AblyService: 🔍 Calling connectionStatusCallback with CONNECTED");
                    this.connectionStatusCallback(ConnectionStatus.CONNECTED);

                    // Re-enter presence after every connected (including auto-reconnect).
                    if (this.ably) {
                        const shouldEnter = !this.presenceEntered;
                        this.presenceEntered = true;
                        this.subscribeEndSession(userId);
                        if (shouldEnter) {
                            const channel = this.ably.channels.get(`private:${userId}`);
                            channel.presence.enter(
                                JSON.stringify({ deviceCode })
                            ).then(() => {
                                console.log(
                                    "AblyService: 🤝 Presence entered once:",
                                    deviceCode
                                );
                                setTimeout(() => {
                                    if (this.isConnected) {
                                        this.connectionStatusCallback(ConnectionStatus.CONNECTED);
                                    }
                                }, 1000);
                            }).catch((err: any) => {
                                console.error(
                                    "AblyService: ❌ Presence error:",
                                    err.message
                                );
                                this.presenceEntered = false;
                            });
                        }
                    }
                    break;

                case "disconnected":
                    // Transient: Ably SDK auto-reconnects. Keep session; require presence re-enter on next connected.
                    this.isConnected = false;
                    this.presenceEntered = false;
                    console.warn(
                        "AblyService: 🔌 Transient disconnect:",
                        stateChange.reason?.message
                    );
                    this.connectionStatusCallback(ConnectionStatus.CONNECTING);
                    break;

                case "failed":
                case "closed":
                    this.isConnected = false;
                    this.presenceEntered = false;
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
        // Debug ridotto - solo per errori
        console.log(`AblyService: 📤 Sending ${eventType} to user ${userId}`);

        if (!this.ably || !this.isConnected) {
            console.warn("AblyService: ⚠️ Cannot send message, not connected");
            console.warn(`AblyService: 🔍 Details - ably exists: ${!!this.ably}, isConnected: ${this.isConnected}`);
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
            console.log(`AblyService: ✅ Sent ${eventType} to private:${userId}`);
        } catch (error: any) {
            console.error(`AblyService: ❌ Failed to send ${eventType}:`, error.message);
        }
    }

    private subscribeEndSession(userId: number) {
        if (!this.ably || !this.endSessionHandler) {
            return;
        }
        if (this.endSessionSubscribedUserId === userId) {
            return;
        }

        const channel = this.ably.channels.get(`private:${userId}`);
        channel.unsubscribe("endSession");
        channel.subscribe("endSession", (message) => {
            console.log("AblyService: 📥 endSession received", message.data);
            let payload: EndSessionPayload = {};
            try {
                if (typeof message.data === "string") {
                    payload = JSON.parse(message.data);
                } else if (message.data && typeof message.data === "object") {
                    payload = message.data as EndSessionPayload;
                }
            } catch (error: any) {
                console.warn(
                    "AblyService: endSession payload parse failed:",
                    error?.message
                );
            }
            this.endSessionHandler?.(payload);
        });
        this.endSessionSubscribedUserId = userId;
        console.log(`AblyService: 👂 Subscribed endSession on private:${userId}`);
    }

    close() {
        if (this.ably && this.endSessionSubscribedUserId != null) {
            try {
                this.ably.channels
                    .get(`private:${this.endSessionSubscribedUserId}`)
                    .unsubscribe("endSession");
            } catch {
                // ignore
            }
        }
        this.endSessionSubscribedUserId = null;
        if (this.ably) {
            this.ably.close();
            console.log("AblyService: 🔒 Connection closed");
            this.ably = null;
            this.isConnected = false;
            this.presenceEntered = false;
            this.connectedUserId = null;
            this.connectedDeviceCode = null;
        }
    }
}
