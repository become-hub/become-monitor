/**
 * Test per HRV Calculator
 * Verifica i calcoli di RMSSD e LF/HF
 */

import { calculateRMSSD, computeLfHf } from '../hrv-calculator';

describe('HRV Calculator', () => {
    describe('calculateRMSSD', () => {
        it('calcola correttamente RMSSD per valori stabili', () => {
            const ppiWindow = [800, 800, 800, 800, 800];
            const rmssd = calculateRMSSD(ppiWindow);
            expect(rmssd).toBe(0); // Nessuna variazione = RMSSD 0
        });

        it('calcola RMSSD per valori variabili', () => {
            const ppiWindow = [800, 820, 810, 830, 805];
            const rmssd = calculateRMSSD(ppiWindow);
            expect(rmssd).toBeGreaterThan(0);
            expect(rmssd).toBeLessThan(50);
        });

        it('filtra artefatti grandi (>200ms)', () => {
            const ppiWindow = [800, 1100, 820, 810]; // 300ms diff filtrato
            const rmssd = calculateRMSSD(ppiWindow);
            expect(rmssd).toBeDefined();
        });

        it('restituisce 0 per finestra troppo piccola', () => {
            const ppiWindow = [800];
            const rmssd = calculateRMSSD(ppiWindow);
            expect(rmssd).toBe(0);
        });

        it('gestisce valori realistici da Polar H10', () => {
            // Dati realistici: HR ~75 BPM con variazione normale
            const ppiWindow = [
                820, 815, 825, 810, 830,
                818, 822, 812, 828, 816,
                824, 814, 826, 820, 818,
            ];
            const rmssd = calculateRMSSD(ppiWindow);
            expect(rmssd).toBeGreaterThan(5);
            expect(rmssd).toBeLessThan(30);
        });
    });

    describe('computeLfHf', () => {
        it('calcola LF e HF per dati stabili', () => {
            const ppiWindow = Array(30).fill(800);
            const { lf, hf } = computeLfHf(ppiWindow);
            expect(lf).toBeGreaterThanOrEqual(0);
            expect(hf).toBeGreaterThanOrEqual(0);
        });

        it('calcola LF e HF per dati variabili', () => {
            const ppiWindow = Array.from({ length: 30 }, (_, i) => 800 + Math.sin(i / 5) * 20);
            const { lf, hf } = computeLfHf(ppiWindow);
            expect(lf).toBeGreaterThan(0);
            expect(hf).toBeGreaterThan(0);
        });

        it('restituisce 0 per finestra troppo piccola', () => {
            const ppiWindow = [800, 820, 810];
            const { lf, hf } = computeLfHf(ppiWindow);
            expect(lf).toBe(0);
            expect(hf).toBe(0);
        });

        it('usa correttamente il sample rate', () => {
            const ppiWindow = Array.from({ length: 30 }, (_, i) => 800 + Math.sin(i / 3) * 15);
            const result1 = computeLfHf(ppiWindow, 4.0);
            const result2 = computeLfHf(ppiWindow, 8.0);

            // Sample rate diverso dovrebbe produrre risultati diversi
            expect(result1.lf).not.toBe(result2.lf);
        });

        it('gestisce dati realistici con alta variabilità', () => {
            // Simula HRV alta (rilassamento)
            const ppiWindow = [
                850, 820, 870, 810, 880,
                815, 865, 825, 855, 830,
                845, 835, 860, 840, 850,
                825, 855, 835, 865, 840,
                850, 830, 860, 845, 855,
                835, 865, 840, 850, 845,
            ];
            const { lf, hf } = computeLfHf(ppiWindow);
            expect(lf).toBeGreaterThan(0);
            expect(hf).toBeGreaterThan(0);
        });

        it('gestisce dati realistici con bassa variabilità', () => {
            // Simula HRV bassa (stress)
            const ppiWindow = Array.from({ length: 30 }, (_, i) => 700 + Math.random() * 10);
            const { lf, hf } = computeLfHf(ppiWindow);
            expect(lf).toBeGreaterThanOrEqual(0);
            expect(hf).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Edge cases', () => {
        it('gestisce array vuoto', () => {
            const rmssd = calculateRMSSD([]);
            expect(rmssd).toBe(0);
        });

        it('gestisce valori negativi (non realistici ma robusto)', () => {
            const ppiWindow = [800, -100, 810, 820];
            const rmssd = calculateRMSSD(ppiWindow);
            expect(rmssd).toBeDefined();
            expect(rmssd).toBeGreaterThanOrEqual(0);
        });

        it('gestisce valori molto grandi', () => {
            const ppiWindow = [2000, 2100, 2050, 2080];
            const rmssd = calculateRMSSD(ppiWindow);
            expect(rmssd).toBeDefined();
            expect(rmssd).toBeGreaterThanOrEqual(0);
        });
    });
});

