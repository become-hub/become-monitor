/**
 * Test per Polar BLE SDK Wrapper
 * Verifica il wrapper TypeScript per il modulo nativo
 */

// Mock del modulo nativo
import { polarSdk } from '../polar-ble-sdk';

const mockPolarBleModule = {
    checkBluetoothState: jest.fn(),
    startScan: jest.fn(),
    stopScan: jest.fn(),
    connectToDevice: jest.fn(),
    disconnectFromDevice: jest.fn(),
    startPpiStreaming: jest.fn(),
    stopPpiStreaming: jest.fn(),
};

const mockEventEmitter = {
    addListener: jest.fn(() => ({
        remove: jest.fn(),
    })),
};

jest.mock('react-native', () => ({
    NativeModules: {
        PolarBleModule: mockPolarBleModule,
    },
    NativeEventEmitter: jest.fn(() => mockEventEmitter),
}));

describe('PolarBleSdk', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkBluetoothState', () => {
        it('chiama il metodo nativo correttamente', async () => {
            mockPolarBleModule.checkBluetoothState.mockResolvedValueOnce(true);

            const result = await polarSdk.checkBluetoothState();

            expect(result).toBe(true);
            expect(mockPolarBleModule.checkBluetoothState).toHaveBeenCalled();
        });

        it('restituisce false quando Bluetooth è spento', async () => {
            mockPolarBleModule.checkBluetoothState.mockResolvedValueOnce(false);

            const result = await polarSdk.checkBluetoothState();

            expect(result).toBe(false);
        });
    });

    describe('startScan', () => {
        it('avvia la scansione dispositivi', async () => {
            mockPolarBleModule.startScan.mockResolvedValueOnce(undefined);

            await polarSdk.startScan();

            expect(mockPolarBleModule.startScan).toHaveBeenCalled();
        });

        it('gestisce errori di scansione', async () => {
            mockPolarBleModule.startScan.mockRejectedValueOnce(new Error('Scan failed'));

            await expect(polarSdk.startScan()).rejects.toThrow('Scan failed');
        });
    });

    describe('stopScan', () => {
        it('ferma la scansione', async () => {
            mockPolarBleModule.stopScan.mockResolvedValueOnce(undefined);

            await polarSdk.stopScan();

            expect(mockPolarBleModule.stopScan).toHaveBeenCalled();
        });
    });

    describe('connectToDevice', () => {
        it('connette al dispositivo con deviceId corretto', async () => {
            mockPolarBleModule.connectToDevice.mockResolvedValueOnce(undefined);

            await polarSdk.connectToDevice('ABC123');

            expect(mockPolarBleModule.connectToDevice).toHaveBeenCalledWith('ABC123');
        });

        it('gestisce errori di connessione', async () => {
            mockPolarBleModule.connectToDevice.mockRejectedValueOnce(new Error('Connection failed'));

            await expect(polarSdk.connectToDevice('XYZ')).rejects.toThrow('Connection failed');
        });
    });

    describe('disconnectFromDevice', () => {
        it('disconnette dal dispositivo', async () => {
            mockPolarBleModule.disconnectFromDevice.mockResolvedValueOnce(undefined);

            await polarSdk.disconnectFromDevice('ABC123');

            expect(mockPolarBleModule.disconnectFromDevice).toHaveBeenCalledWith('ABC123');
        });
    });

    describe('startPpiStreaming', () => {
        it('avvia lo streaming PPI', async () => {
            mockPolarBleModule.startPpiStreaming.mockResolvedValueOnce(undefined);

            await polarSdk.startPpiStreaming('ABC123');

            expect(mockPolarBleModule.startPpiStreaming).toHaveBeenCalledWith('ABC123');
        });

        it('gestisce quando PPI non è disponibile', async () => {
            mockPolarBleModule.startPpiStreaming.mockRejectedValueOnce(
                new Error('PPI not available')
            );

            await expect(polarSdk.startPpiStreaming('XYZ')).rejects.toThrow('PPI not available');
        });
    });

    describe('stopPpiStreaming', () => {
        it('ferma lo streaming PPI', async () => {
            mockPolarBleModule.stopPpiStreaming.mockResolvedValueOnce(undefined);

            await polarSdk.stopPpiStreaming();

            expect(mockPolarBleModule.stopPpiStreaming).toHaveBeenCalled();
        });
    });

    describe('Event Listeners', () => {
        it('aggiunge listener per Bluetooth state', () => {
            const callback = jest.fn();

            polarSdk.addEventListener('onBluetoothStateChanged', callback);

            expect(mockEventEmitter.addListener).toHaveBeenCalledWith(
                'onBluetoothStateChanged',
                callback
            );
        });

        it('aggiunge listener per device found', () => {
            const callback = jest.fn();

            polarSdk.addEventListener('onDeviceFound', callback);

            expect(mockEventEmitter.addListener).toHaveBeenCalledWith('onDeviceFound', callback);
        });

        it('aggiunge listener per device connected', () => {
            const callback = jest.fn();

            polarSdk.addEventListener('onDeviceConnected', callback);

            expect(mockEventEmitter.addListener).toHaveBeenCalledWith('onDeviceConnected', callback);
        });

        it('aggiunge listener per device disconnected', () => {
            const callback = jest.fn();

            polarSdk.addEventListener('onDeviceDisconnected', callback);

            expect(mockEventEmitter.addListener).toHaveBeenCalledWith(
                'onDeviceDisconnected',
                callback
            );
        });

        it('aggiunge listener per heart rate', () => {
            const callback = jest.fn();

            polarSdk.addEventListener('onHeartRateReceived', callback);

            expect(mockEventEmitter.addListener).toHaveBeenCalledWith(
                'onHeartRateReceived',
                callback
            );
        });

        it('aggiunge listener per PPI data', () => {
            const callback = jest.fn();

            polarSdk.addEventListener('onPpiDataReceived', callback);

            expect(mockEventEmitter.addListener).toHaveBeenCalledWith('onPpiDataReceived', callback);
        });

        it('aggiunge listener per PPI stream error', () => {
            const callback = jest.fn();

            polarSdk.addEventListener('onPpiStreamError', callback);

            expect(mockEventEmitter.addListener).toHaveBeenCalledWith('onPpiStreamError', callback);
        });
    });

    describe('Remove Listeners', () => {
        it('rimuove un listener specifico', () => {
            const callback = jest.fn();
            const mockSubscription = { remove: jest.fn() };
            mockEventEmitter.addListener.mockReturnValueOnce(mockSubscription);

            polarSdk.addEventListener('onHeartRateReceived', callback);
            polarSdk.removeEventListener('onHeartRateReceived');

            expect(mockSubscription.remove).toHaveBeenCalled();
        });

        it('gestisce rimozione di listener non esistente', () => {
            expect(() => {
                polarSdk.removeEventListener('onHeartRateReceived');
            }).not.toThrow();
        });

        it('rimuove tutti i listener', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const mockSub1 = { remove: jest.fn() };
            const mockSub2 = { remove: jest.fn() };

            mockEventEmitter.addListener
                .mockReturnValueOnce(mockSub1)
                .mockReturnValueOnce(mockSub2);

            polarSdk.addEventListener('onHeartRateReceived', callback1);
            polarSdk.addEventListener('onPpiDataReceived', callback2);

            polarSdk.removeAllListeners();

            expect(mockSub1.remove).toHaveBeenCalled();
            expect(mockSub2.remove).toHaveBeenCalled();
        });
    });

    describe('Integration scenarios', () => {
        it('gestisce flusso completo: scan → connect → stream', async () => {
            mockPolarBleModule.checkBluetoothState.mockResolvedValueOnce(true);
            mockPolarBleModule.startScan.mockResolvedValueOnce(undefined);
            mockPolarBleModule.connectToDevice.mockResolvedValueOnce(undefined);
            mockPolarBleModule.startPpiStreaming.mockResolvedValueOnce(undefined);

            const btState = await polarSdk.checkBluetoothState();
            expect(btState).toBe(true);

            await polarSdk.startScan();
            await polarSdk.connectToDevice('POLAR-H10');
            await polarSdk.startPpiStreaming('POLAR-H10');

            expect(mockPolarBleModule.startScan).toHaveBeenCalled();
            expect(mockPolarBleModule.connectToDevice).toHaveBeenCalledWith('POLAR-H10');
            expect(mockPolarBleModule.startPpiStreaming).toHaveBeenCalledWith('POLAR-H10');
        });

        it('gestisce cleanup: stop stream → disconnect → stop scan', async () => {
            mockPolarBleModule.stopPpiStreaming.mockResolvedValueOnce(undefined);
            mockPolarBleModule.disconnectFromDevice.mockResolvedValueOnce(undefined);
            mockPolarBleModule.stopScan.mockResolvedValueOnce(undefined);

            await polarSdk.stopPpiStreaming();
            await polarSdk.disconnectFromDevice('POLAR-H10');
            await polarSdk.stopScan();

            expect(mockPolarBleModule.stopPpiStreaming).toHaveBeenCalled();
            expect(mockPolarBleModule.disconnectFromDevice).toHaveBeenCalledWith('POLAR-H10');
            expect(mockPolarBleModule.stopScan).toHaveBeenCalled();
        });
    });
});

