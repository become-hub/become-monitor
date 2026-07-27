/**
 * Test per Auth Service
 * Verifica il flusso di autenticazione del dispositivo
 */

import { AuthService } from '../auth-service';
import { API_PRODUCTION_URL, API_STAGING_URL } from '@/constants/constants';
import { useSettingsStore } from '@/stores/settings-store';

describe('AuthService', () => {
    let authService: AuthService;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        authService = new AuthService();
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        useSettingsStore.setState({ debugMode: false, developerMode: false });
        jest.clearAllMocks();
    });

    describe('startDeviceAuth', () => {
        it('restituisce codice e token quando la risposta è OK', async () => {
            const mockResponse = {
                code: 'A1B2',
                deviceToken: 'token-123',
                expiresAt: 1234567890,
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await authService.startDeviceAuth();

            expect(result).toEqual(mockResponse);
            expect(global.fetch).toHaveBeenCalledWith(
                `${API_PRODUCTION_URL}/auth/device/start`
            );
        });

        it('restituisce null quando la risposta non è OK', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await authService.startDeviceAuth();

            expect(result).toBeNull();
        });

        it('gestisce errori di rete', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await authService.startDeviceAuth();

            expect(result).toBeNull();
        });
    });

    describe('pollDeviceAuth', () => {
        it('restituisce dati autenticati quando l\'utente conferma', async () => {
            const mockResponse = {
                authenticated: true,
                userId: '123',
                session: 'session-token',
                deviceCode: 'device-abc',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockResponse),
            });

            const result = await authService.pollDeviceAuth('token-123');

            expect(result).toEqual(mockResponse);
            expect(global.fetch).toHaveBeenCalledWith(
                `${API_PRODUCTION_URL}/auth/device/pool?deviceToken=token-123`
            );
        });

        it('restituisce authenticated=false quando l\'utente non ha ancora confermato', async () => {
            const mockResponse = {
                authenticated: false,
                userId: '',
                session: '',
                deviceCode: '',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify(mockResponse),
            });

            const result = await authService.pollDeviceAuth('token-123');

            expect(result?.authenticated).toBe(false);
        });

        it('gestisce risposta vuota', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => '{}',
            });

            const result = await authService.pollDeviceAuth('token-123');

            expect(result?.authenticated).toBe(false);
            expect(result?.userId).toBe('');
        });

        it('restituisce null quando la risposta non è OK', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await authService.pollDeviceAuth('token-123');

            expect(result).toBeNull();
        });

        it('gestisce JSON malformato', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => 'not-json',
            });

            const result = await authService.pollDeviceAuth('token-123');

            expect(result).toBeNull();
        });

        it('gestisce errori di rete', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await authService.pollDeviceAuth('token-123');

            expect(result).toBeNull();
        });

        it('restituisce null per status code 500', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            });

            const result = await authService.pollDeviceAuth('token-123');

            expect(result).toBeNull();
        });

        it('restituisce null per status code 401 unauthorized', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized',
            });

            const result = await authService.pollDeviceAuth('token-123');

            expect(result).toBeNull();
        });
    });

    describe('Flusso completo di autenticazione', () => {
        it('completa il flusso start -> poll con successo', async () => {
            // Step 1: Start
            const startResponse = {
                code: 'TEST',
                deviceToken: 'token-xyz',
                expiresAt: Date.now() / 1000 + 3600,
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => startResponse,
            });

            const start = await authService.startDeviceAuth();
            expect(start?.code).toBe('TEST');

            // Step 2: Poll (prima non autenticato)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ authenticated: false, userId: '', session: '', deviceCode: '' }),
            });

            const poll1 = await authService.pollDeviceAuth(start!.deviceToken);
            expect(poll1?.authenticated).toBe(false);

            // Step 3: Poll (poi autenticato)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    authenticated: true,
                    userId: '456',
                    session: 'session-abc',
                    deviceCode: 'dev-123',
                }),
            });

            const poll2 = await authService.pollDeviceAuth(start!.deviceToken);
            expect(poll2?.authenticated).toBe(true);
            expect(poll2?.userId).toBe('456');
        });
    });

    describe('endpoint resolution by developerMode', () => {
        it('usa staging quando developerMode è attiva', async () => {
            useSettingsStore.setState({ developerMode: true });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    code: 'S1',
                    deviceToken: 'token-staging',
                    expiresAt: 1234567890,
                }),
            });

            await authService.startDeviceAuth();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_STAGING_URL}/auth/device/start`
            );
        });

        it('torna a production quando developerMode è disattivata', async () => {
            useSettingsStore.setState({ developerMode: true });
            useSettingsStore.setState({ developerMode: false });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    code: 'P1',
                    deviceToken: 'token-production',
                    expiresAt: 1234567890,
                }),
            });

            await authService.startDeviceAuth();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_PRODUCTION_URL}/auth/device/start`
            );
        });
    });
});

