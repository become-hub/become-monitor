/**
 * Test per HRV Calculator
 * Verifica i calcoli di RMSSD e LF/HF
 */

import {
    calculateRMSSD,
    computeLfHf,
    MAX_SUCCESSIVE_DIFF_MS,
    replaceSuccessiveJumpArtifacts,
} from '../hrv-calculator';
import FFT from 'fft.js';

/** Previous computeLfHf path (no successive-jump cleanup) for regression checks. */
function computeLfHfWithoutJumpFilter(
    ppiWindow: number[],
    sampleRateHz: number = 4.0
): { lf: number; hf: number } {
    if (ppiWindow.length < 10) {
        return { lf: 0, hf: 0 };
    }
    const n = Math.floor((ppiWindow.length * sampleRateHz) / 1.0);
    const evenly: number[] = [];
    for (let i = 0; i < n; i++) {
        const pos = (i * (ppiWindow.length - 1)) / (n - 1);
        const lo = Math.floor(pos);
        const hi = Math.min(lo + 1, ppiWindow.length - 1);
        const frac = pos - lo;
        evenly.push(ppiWindow[lo] * (1 - frac) + ppiWindow[hi] * frac);
    }
    const mean = evenly.reduce((a, b) => a + b, 0) / evenly.length;
    const detrended = evenly.map((v) => v - mean);
    let fftSize = 1;
    while (fftSize < n) {
        fftSize = fftSize << 1;
    }
    const fftInput = new Array(fftSize).fill(0);
    for (let i = 0; i < detrended.length; i++) {
        fftInput[i] = detrended[i];
    }
    const fft = new FFT(fftSize);
    const out = fft.createComplexArray();
    fft.realTransform(out, fftInput);
    const df = sampleRateHz / fftSize;
    const half = Math.floor(fftSize / 2);
    let lf = 0;
    let hf = 0;
    for (let k = 0; k < half; k++) {
        const re = out[2 * k];
        const im = out[2 * k + 1];
        const power = (re * re + im * im) / (sampleRateHz * fftSize);
        const freq = k * df;
        if (freq >= 0.04 && freq <= 0.15) {
            lf += power * df;
        }
        if (freq >= 0.15 && freq <= 0.4) {
            hf += power * df;
        }
    }
    return { lf, hf };
}

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

        it('interpola un picco isolato e non gonfia LF/HF', () => {
            const baseline = Array.from(
                { length: 30 },
                (_, i) => 800 + Math.sin(i / 5) * 20
            );
            const withSpike = [...baseline];
            withSpike[10] = 1600;

            const cleaned = replaceSuccessiveJumpArtifacts(withSpike);
            expect(cleaned).not.toBeNull();
            expect(cleaned![10]).toBeCloseTo(
                (baseline[9] + baseline[11]) / 2,
                5
            );

            const filtered = computeLfHf(withSpike);
            const unfiltered = computeLfHfWithoutJumpFilter(withSpike);
            const clean = computeLfHf(baseline);

            expect(unfiltered.lf + unfiltered.hf).toBeGreaterThan(1000);
            expect(filtered.lf + filtered.hf).toBeLessThan(
                (unfiltered.lf + unfiltered.hf) / 10
            );
            expect(filtered.lf).toBeCloseTo(clean.lf, 1);
            expect(filtered.hf).toBeCloseTo(clean.hf, 1);
        });

        it('restituisce 0 se restano meno di 10 intervalli accettati', () => {
            // Ogni campione salta di 250 ms dal primo accettato → solo 1 valido.
            const ppiWindow = Array.from(
                { length: 30 },
                (_, i) => 800 + i * (MAX_SUCCESSIVE_DIFF_MS + 50)
            );
            expect(replaceSuccessiveJumpArtifacts(ppiWindow)).toBeNull();
            const { lf, hf } = computeLfHf(ppiWindow);
            expect(lf).toBe(0);
            expect(hf).toBe(0);
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

