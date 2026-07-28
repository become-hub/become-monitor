/**
 * Polar BLE SDK Bridge
 * Interfaccia TypeScript per il modulo nativo Polar SDK
 */

import { NativeEventEmitter, NativeModules } from "react-native";

const { PolarBleModule } = NativeModules;

export interface PolarDeviceInfo {
    deviceId: string;
    name: string;
    rssi?: number;
}

export interface PolarHrData {
    deviceId: string;
    hr: number;
    contactDetected: boolean;
    contactSupported: boolean;
}

export interface PolarPpiSample {
    ppi: number;
    hr: number;
    blocker: boolean;
    errorEstimate: number;
}

export interface PolarPpiData {
    deviceId: string;
    samples: PolarPpiSample[];
}

export interface PolarOfflinePpiSample {
    ppiMs: number;
    hr: number;
    errorEstimate: number;
    blockerBit: boolean;
    t?: string;
}

export interface PolarOfflinePpiTrack {
    path: string;
    size: number;
    startedAt?: string | null;
    samples: PolarOfflinePpiSample[];
}

export interface BluetoothState {
    powered: boolean;
}

export type PolarEventType =
    | "onBluetoothStateChanged"
    | "onDeviceFound"
    | "onDeviceConnected"
    | "onDeviceDisconnected"
    | "onPairingFailed"
    | "onHeartRateReceived"
    | "onPpiDataReceived"
    | "onPpiStreamError";

class PolarBleSdk {
    private eventEmitter: NativeEventEmitter;
    private listeners: Map<string, any> = new Map();

    constructor() {
        this.eventEmitter = new NativeEventEmitter(PolarBleModule);
    }

    /**
     * Controlla lo stato del Bluetooth
     */
    async checkBluetoothState(): Promise<boolean> {
        return PolarBleModule.checkBluetoothState();
    }

    /**
     * Verifica se i permessi Bluetooth sono concessi
     */
    async hasBluetoothPermissions(): Promise<boolean> {
        return PolarBleModule.hasBluetoothPermissions();
    }

    /**
     * Richiede i permessi Bluetooth necessari
     */
    async requestBluetoothPermissions(): Promise<void> {
        return PolarBleModule.requestBluetoothPermissions();
    }

    /**
     * Richiede di attivare il Bluetooth (mostra dialog sistema)
     */
    async requestEnableBluetooth(): Promise<boolean> {
        return PolarBleModule.requestEnableBluetooth();
    }

    /**
     * Attiva o disattiva il Bluetooth direttamente
     */
    async setBluetoothEnabled(enable: boolean): Promise<boolean> {
        return PolarBleModule.setBluetoothEnabled(enable);
    }

    // openBluetoothSettings rimosso: non supportiamo più spegnimento via app

    /**
     * Avvia la scansione dei dispositivi Polar
     */
    async startScan(): Promise<void> {
        return PolarBleModule.startScan();
    }

    /**
     * Ferma la scansione
     */
    async stopScan(): Promise<void> {
        return PolarBleModule.stopScan();
    }

    /**
     * Connetti a un dispositivo Polar
     */
    async connectToDevice(deviceId: string): Promise<void> {
        return PolarBleModule.connectToDevice(deviceId);
    }

    /**
     * Disconnetti da un dispositivo
     */
    async disconnectFromDevice(deviceId: string): Promise<void> {
        return PolarBleModule.disconnectFromDevice(deviceId);
    }

    /**
     * Assicura First Time Use sul Polar 360 (idempotente).
     * Da chiamare dopo la connessione e prima dello streaming.
     * @returns performed=true se FTU è stato appena eseguito (device in restart).
     */
    async ensureFirstTimeUse(
        deviceId: string
    ): Promise<{ performed: boolean }> {
        const result = await PolarBleModule.ensureFirstTimeUse(deviceId);
        if (result && typeof result === "object" && "performed" in result) {
            return { performed: !!result.performed };
        }
        return { performed: false };
    }

    /**
     * Avvia lo streaming dei dati PPI (RR intervals)
     */
    async startPpiStreaming(deviceId: string): Promise<void> {
        return PolarBleModule.startPpiStreaming(deviceId);
    }

    /**
     * Ferma lo streaming PPI
     */
    async stopPpiStreaming(): Promise<void> {
        return PolarBleModule.stopPpiStreaming();
    }

    async startPpiOfflineRecording(deviceId: string): Promise<void> {
        return PolarBleModule.startPpiOfflineRecording(deviceId);
    }

    async stopPpiOfflineRecording(deviceId: string): Promise<void> {
        return PolarBleModule.stopPpiOfflineRecording(deviceId);
    }

    async fetchLatestPpiOfflineRecord(
        deviceId: string
    ): Promise<PolarOfflinePpiTrack> {
        return PolarBleModule.fetchLatestPpiOfflineRecord(deviceId);
    }

    async removePpiOfflineRecord(deviceId: string, path: string): Promise<void> {
        return PolarBleModule.removePpiOfflineRecord(deviceId, path);
    }

    /**
     * Avvia un Foreground Service (connectedDevice) per tenere viva
     * la connessione Polar/Ably a schermo bloccato.
     */
    async startMonitorForegroundService(deviceName?: string | null): Promise<void> {
        return PolarBleModule.startMonitorForegroundService(deviceName ?? null);
    }

    /**
     * Aggiorna la notifica FGS con dispositivo e metriche live.
     */
    async updateMonitorForegroundService(
        deviceName: string | null | undefined,
        hr: number,
        hrv: number,
        lf: number,
        hf: number
    ): Promise<void> {
        return PolarBleModule.updateMonitorForegroundService(
            deviceName ?? null,
            hr,
            hrv,
            lf,
            hf
        );
    }

    async stopMonitorForegroundService(): Promise<void> {
        return PolarBleModule.stopMonitorForegroundService();
    }

    /**
     * Ascolta gli eventi dal modulo nativo
     */
    addEventListener(
        event: "onBluetoothStateChanged",
        callback: (state: BluetoothState) => void
    ): void;
    addEventListener(
        event: "onDeviceFound",
        callback: (device: PolarDeviceInfo) => void
    ): void;
    addEventListener(
        event: "onDeviceConnected",
        callback: (device: PolarDeviceInfo) => void
    ): void;
    addEventListener(
        event: "onDeviceDisconnected",
        callback: (device: PolarDeviceInfo) => void
    ): void;
    addEventListener(
        event: "onPairingFailed",
        callback: (payload: {
            deviceId: string;
            connectedMs: number;
            features: string;
            removedBonds: number;
        }) => void
    ): void;
    addEventListener(
        event: "onHeartRateReceived",
        callback: (data: PolarHrData) => void
    ): void;
    addEventListener(
        event: "onPpiDataReceived",
        callback: (data: PolarPpiData) => void
    ): void;
    addEventListener(
        event: "onPpiStreamError",
        callback: (error: { error: string }) => void
    ): void;
    addEventListener(event: PolarEventType, callback: (data: any) => void): void {
        const subscription = this.eventEmitter.addListener(event, callback);
        this.listeners.set(event, subscription);
    }

    /**
     * Rimuovi listener per un evento
     */
    removeEventListener(event: PolarEventType): void {
        const subscription = this.listeners.get(event);
        if (subscription) {
            subscription.remove();
            this.listeners.delete(event);
        }
    }

    /**
     * Rimuovi tutti i listener
     */
    removeAllListeners(): void {
        this.listeners.forEach((subscription) => subscription.remove());
        this.listeners.clear();
    }
}

export const polarSdk = new PolarBleSdk();

