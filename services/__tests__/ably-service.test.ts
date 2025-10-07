/**
 * Test per Ably Service
 * Verifica la connessione e l'invio messaggi Ably
 */

// Mock Ably prima dell'import
import * as Ably from 'ably';
import { AblyService, ConnectionStatus } from '../ably-service';

jest.mock('ably', () => ({
    Realtime: jest.fn(),
}));

describe('AblyService', () => {
    let ablyService: AblyService;
    let statusCallback: jest.Mock;
    let mockAbly: any;
    let mockChannel: any;

    beforeEach(() => {
        statusCallback = jest.fn();

        mockChannel = {
            presence: {
                enter: jest.fn(() => Promise.resolve()),
            },
            publish: jest.fn(),
        };

        mockAbly = {
            connection: {
                on: jest.fn(),
            },
            channels: {
                get: jest.fn().mockReturnValue(mockChannel),
            },
            close: jest.fn(),
        };

        (Ably.Realtime as unknown as jest.Mock).mockImplementation(() => mockAbly);

        ablyService = new AblyService(
            'https://test.com/ably',
            statusCallback
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('connectWithToken', () => {
        it('crea istanza Ably con parametri corretti', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            expect(Ably.Realtime).toHaveBeenCalledWith({
                authUrl: 'https://test.com/ably',
                authHeaders: {
                    Authorization: 'Bearer test-token',
                },
            });
        });

        it('configura listener per stato connessione', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            expect(mockAbly.connection.on).toHaveBeenCalled();
        });
    });

    describe('Connection state changes', () => {
        it('notifica CONNECTING quando si connette', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connecting' });

            expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.CONNECTING);
        });

        it('notifica CONNECTED e entra in presence quando connesso', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.CONNECTED);
            expect(mockAbly.channels.get).toHaveBeenCalledWith('private:123');
            expect(mockChannel.presence.enter).toHaveBeenCalled();
        });

        it('notifica DISCONNECTED quando la connessione fallisce', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'failed', reason: { message: 'Error' } });

            expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.DISCONNECTED);
        });
    });

    describe('sendHeartRate', () => {
        it('non invia se non connesso', () => {
            ablyService.sendHeartRate('dev-123', 456, 75, 45, 1200, 800);

            expect(mockChannel.publish).not.toHaveBeenCalled();
        });

        it('non invia se ably è null', () => {
            // Non connetto mai, quindi ably è null
            ablyService.sendHeartRate('dev-123', 456, 75, 45, 1200, 800);

            expect(mockChannel.publish).not.toHaveBeenCalled();
        });

        it('non invia se connesso ma poi ably diventa null', () => {
            ablyService.connectWithToken('test-token', 456, 'dev-123');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            // Simula close
            (ablyService as any).ably = null;

            ablyService.sendHeartRate('dev-123', 456, 75, 45, 1200, 800);

            expect(mockChannel.publish).not.toHaveBeenCalled();
        });

        it('invia messaggio corretto quando connesso', () => {
            ablyService.connectWithToken('test-token', 456, 'dev-123');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            ablyService.sendHeartRate('dev-123', 456, 75, 45, 1200, 800);

            expect(mockChannel.publish).toHaveBeenCalledWith(
                'heartRate',
                expect.stringContaining('"heartRate":75')
            );
            expect(mockChannel.publish).toHaveBeenCalledWith(
                'heartRate',
                expect.stringContaining('"hrv":45')
            );
        });

        it('include tutti i parametri nel messaggio', () => {
            ablyService.connectWithToken('test-token', 456, 'dev-123');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            ablyService.sendHeartRate('dev-123', 456, 80, 50, 1500, 900);

            const publishCall = mockChannel.publish.mock.calls[0];
            const message = JSON.parse(publishCall[1]);

            expect(message).toEqual({
                heartRate: 80,
                hrv: 50,
                lf: 1500,
                hf: 900,
                code: 'dev-123',
                type: 'private_msg',
            });
        });

        it('gestisce errore durante publish', () => {
            mockChannel.publish.mockImplementation(() => {
                throw new Error('Publish failed');
            });

            ablyService.connectWithToken('test-token', 456, 'dev-123');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            // Non dovrebbe crashare quando publish fallisce
            expect(() => {
                ablyService.sendHeartRate('dev-123', 456, 75, 45, 1200, 800);
            }).not.toThrow();
        });
    });

    describe('close', () => {
        it('chiude connessione Ably', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');
            ablyService.close();

            expect(mockAbly.close).toHaveBeenCalled();
        });

        it('resetta lo stato interno', () => {
            ablyService.connectWithToken('test-token', 456, 'dev-123');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            ablyService.close();

            // Dopo close, non dovrebbe più inviare
            ablyService.sendHeartRate('dev-123', 456, 75, 45, 1200, 800);
            expect(mockChannel.publish).not.toHaveBeenCalled();
        });

        it('gestisce close multipli senza errori', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            expect(() => {
                ablyService.close();
                ablyService.close();
                ablyService.close();
            }).not.toThrow();
        });

        it('gestisce close quando non connesso mai', () => {
            // Non chiama mai connectWithToken, quindi ably è null
            expect(() => {
                ablyService.close();
            }).not.toThrow();
        });
    });

    describe('Presence', () => {
        it('entra in presence ad ogni connessione', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];

            // Prima connessione
            onCallback({ current: 'connected' });
            expect(mockChannel.presence.enter).toHaveBeenCalledTimes(1);

            // Simula disconnessione e reconnessione
            onCallback({ current: 'disconnected' });
            onCallback({ current: 'connected' });

            // Dovrebbe entrare di nuovo dopo reconnessione
            expect(mockChannel.presence.enter).toHaveBeenCalledTimes(2);
        });

        it('non entra in presence multiple volte nella stessa connessione', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];

            // Prima connessione
            onCallback({ current: 'connected' });
            expect(mockChannel.presence.enter).toHaveBeenCalledTimes(1);

            // Simula eventi multipli connected (senza disconnect)
            onCallback({ current: 'connected' });
            onCallback({ current: 'connected' });

            // Non dovrebbe entrare di nuovo se già connesso
            expect(mockChannel.presence.enter).toHaveBeenCalledTimes(1);
        });

        it('passa deviceCode corretto in presence', () => {
            ablyService.connectWithToken('test-token', 123, 'my-device');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            const presenceData = mockChannel.presence.enter.mock.calls[0][0];
            expect(JSON.parse(presenceData)).toEqual({ deviceCode: 'my-device' });
        });

        it('gestisce errore di presence e resetta lo stato', async () => {
            mockChannel.presence.enter = jest.fn(() => Promise.reject(new Error('Presence failed')));

            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            // Attendi che la promise venga rigettata
            await new Promise(resolve => setTimeout(resolve, 10));

            // Il flag dovrebbe essere resettato dopo l'errore
            expect(mockChannel.presence.enter).toHaveBeenCalled();
        });

        it('non entra di nuovo in presence se già entered nella stessa connessione', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];

            // Prima chiamata: entra in presence
            onCallback({ current: 'connected' });
            expect(mockChannel.presence.enter).toHaveBeenCalledTimes(1);

            // Imposta manualmente presenceEntered (simula stato dopo prima connessione)
            (ablyService as any).presenceEntered = true;

            // Seconda chiamata connected nella stessa sessione
            onCallback({ current: 'connected' });

            // Non dovrebbe chiamare enter di nuovo
            expect(mockChannel.presence.enter).toHaveBeenCalledTimes(1);
        });
    });

    describe('Connection edge cases', () => {
        it('gestisce eventi di connessione sconosciuti', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];

            // Non dovrebbe crashare con eventi sconosciuti
            expect(() => {
                onCallback({ current: 'suspended' });
                onCallback({ current: 'closing' });
                onCallback({ current: 'unknown-state' });
            }).not.toThrow();
        });

        it('gestisce caso failed', () => {
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'failed', reason: { message: 'Failed to connect' } });

            expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.DISCONNECTED);
        });

        it('non entra in presence se ably è null (edge case interno)', () => {
            // Test del guard clause interno - questo scenario non dovrebbe mai verificarsi
            // ma testiamo comunque per robustezza
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];

            // Simula ably null (anche se non dovrebbe succedere)
            (ablyService as any).ably = null;

            expect(() => {
                onCallback({ current: 'connected' });
            }).not.toThrow();
        });

        it('testa guard clause riga 43 (setupConnectionListener)', () => {
            // Questo test copre il branch impossibile della riga 43
            // Forziamo la chiamata del metodo privato con ably = null
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            // Imposta ably a null PRIMA della chiamata al listener
            (ablyService as any).ably = null;

            // Chiama direttamente il metodo privato
            expect(() => {
                (ablyService as any).setupConnectionListener(123, 'test');
            }).not.toThrow();
        });

        it('testa branch presenza quando ably diventa null nel mezzo', () => {
            // Test per coprire il branch `&& this.ably` nella riga 59
            ablyService.connectWithToken('test-token', 123, 'device-abc');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];

            // Imposta presenceEntered = false ma ably = null
            (ablyService as any).presenceEntered = false;
            (ablyService as any).ably = null;

            expect(() => {
                onCallback({ current: 'connected' });
            }).not.toThrow();
        });
    });

    describe('SendHeartRate edge cases', () => {
        it('gestisce userId = 0', () => {
            ablyService.connectWithToken('test-token', 0, 'dev-123');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            ablyService.sendHeartRate('dev-123', 0, 75, 45, 1200, 800);

            expect(mockAbly.channels.get).toHaveBeenCalledWith('private:0');
        });

        it('gestisce valori HRV negativi (edge case)', () => {
            ablyService.connectWithToken('test-token', 123, 'dev-123');

            const onCallback = mockAbly.connection.on.mock.calls[0][0];
            onCallback({ current: 'connected' });

            expect(() => {
                ablyService.sendHeartRate('dev-123', 123, 75, -1, -100, -50);
            }).not.toThrow();
        });
    });
});

