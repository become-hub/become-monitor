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

export type AblySendStats = {
    /** Publishes acked by Ably. */
    sent: number;
    /** Publishes rejected by Ably (e.g. 40009 message too large). */
    failed: number;
    /** Last acked message, as published (including `type`, `code`, `timestamp`). */
    lastMessage: Record<string, unknown> | null;
    lastSentAt: number | null;
    lastError: string | null;
};

export const EMPTY_ABLY_SEND_STATS: AblySendStats = {
    sent: 0,
    failed: 0,
    lastMessage: null,
    lastSentAt: null,
    lastError: null,
};

export class AblyService {
    private ably: Ably.Realtime | null = null;
    private isConnected = false;
    private presenceEntered = false;
    private connectedUserId: number | null = null;
    private connectedDeviceCode: string | null = null;
    private connectedDeviceName: string | null = null;
    private sendStats: AblySendStats = { ...EMPTY_ABLY_SEND_STATS };
    private sendStatsListener: ((stats: AblySendStats) => void) | null = null;
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

    connectWithToken(
        authToken: string,
        userId: number,
        deviceCode: string,
        deviceName?: string | null
    ) {
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
            this.connectedDeviceName = null;
        }

        this.connectedUserId = userId;
        this.connectedDeviceCode = deviceCode;
        this.connectedDeviceName = deviceName?.trim() || null;
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
                                JSON.stringify({
                                    deviceCode,
                                    deviceName: this.connectedDeviceName,
                                })
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

                case "closed":
                    // Intentional: only reached via ably.close() (logout, re-pair, end session).
                    this.isConnected = false;
                    this.presenceEntered = false;
                    console.log("AblyService: 🔒 Connection closed (intentional)");
                    this.connectionStatusCallback(ConnectionStatus.DISCONNECTED);
                    break;

                case "failed":
                    this.isConnected = false;
                    this.presenceEntered = false;
                    console.error(
                        "AblyService: 🚫 Connection failed:",
                        stateChange.reason?.message
                    );
                    this.connectionStatusCallback(ConnectionStatus.DISCONNECTED);
                    break;

                default:
                    console.log("AblyService: 🔄 Event:", stateChange.current);
            }
        });
    }

    /**
     * True when publish should be dropped (no client, or terminal connection state).
     * Transient `connecting` / `disconnected` still publish — Ably SDK queues them.
     */
    private shouldDropPublish(): boolean {
        if (!this.ably) {
            return true;
        }
        const state = this.ably.connection?.state;
        return state === "failed" || state === "closed" || state === "suspended";
    }

    /**
     * Metodo generico per inviare messaggi ad Ably.
     * During transient disconnect/reconnect, publish is still called so the SDK
     * can queue (`queueMessages` default) and flush when connected again.
     * @returns Promise that resolves true on Ably ack, false on drop/reject.
     */
    sendMessage(
        userId: number,
        eventType: string,
        data: any,
        deviceCode?: string
    ): Promise<boolean> {
        // Debug ridotto - solo per errori
        console.log(`AblyService: 📤 Sending ${eventType} to user ${userId}`);

        if (this.shouldDropPublish()) {
            console.warn("AblyService: ⚠️ Cannot send message, Ably unavailable");
            console.warn(
                `AblyService: 🔍 Details - ably exists: ${!!this.ably}, state: ${
                    this.ably?.connection?.state ?? "n/a"
                }, isConnected: ${this.isConnected}`
            );
            return Promise.resolve(false);
        }

        try {
            const channel = this.ably!.channels.get(`private:${userId}`);
            const message = {
                ...data,
                type: eventType,
                code: deviceCode,
                timestamp: new Date().toISOString(),
            };

            const serialized = JSON.stringify(message);
            const publishResult: Promise<unknown> = Promise.resolve(
                channel.publish(eventType, serialized)
            );
            this.trackPublish(publishResult, message);
            console.log(`AblyService: ✅ Sent ${eventType} to private:${userId}`);
            return publishResult.then(
                () => true,
                () => false
            );
        } catch (error: any) {
            console.error(`AblyService: ❌ Failed to send ${eventType}:`, error.message);
            return Promise.resolve(false);
        }
    }

    /** Snapshot of publishes acked (or rejected) by Ably since the last reset. */
    getSendStats(): AblySendStats {
        return this.sendStats;
    }

    /** Notified on every acked / rejected publish and on `resetSendStats`. */
    setSendStatsListener(listener: ((stats: AblySendStats) => void) | null) {
        this.sendStatsListener = listener;
    }

    resetSendStats() {
        this.sendStats = { ...EMPTY_ABLY_SEND_STATS };
        this.sendStatsListener?.(this.sendStats);
    }

    /** Counts a publish only once Ably acks it (a rejected publish is `failed`). */
    private trackPublish(
        result: Promise<unknown>,
        message: Record<string, unknown>
    ) {
        result.then(
            () => {
                this.sendStats = {
                    ...this.sendStats,
                    sent: this.sendStats.sent + 1,
                    lastMessage: message,
                    lastSentAt: Date.now(),
                };
                this.sendStatsListener?.(this.sendStats);
            },
            (err: any) => {
                this.sendStats = {
                    ...this.sendStats,
                    failed: this.sendStats.failed + 1,
                    lastError: String(err?.message ?? err).slice(0, 200),
                };
                this.sendStatsListener?.(this.sendStats);
            }
        );
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
