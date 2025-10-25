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

export interface BluetoothState {
    powered: boolean;
}

export type PolarEventType =
    | "onBluetoothStateChanged"
    | "onDeviceFound"
    | "onDeviceConnected"
    | "onDeviceDisconnected"
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

