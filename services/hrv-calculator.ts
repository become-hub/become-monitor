/**
 * HRV Calculator
 * Calcola metriche HRV (RMSSD) e analisi della frequenza (LF/HF) usando FFT
 */

import FFT from "fft.js";

/**
 * Calcola RMSSD (Root Mean Square of Successive Differences) da una finestra di valori PPI
 */
export function calculateRMSSD(ppiWindow: number[]): number {
    if (ppiWindow.length < 2) return 0;

    // Calcola le differenze successive
    const diffs = [];
    for (let i = 0; i < ppiWindow.length - 1; i++) {
        const diff = ppiWindow[i + 1] - ppiWindow[i];
        // Filtra artefatti grandi (>200ms)
        if (Math.abs(diff) < 200) {
            diffs.push(diff);
        }
    }

    if (diffs.length < 2) return 0;

    // Calcola la media dei quadrati
    const squaredDiffs = diffs.map((d) => d * d);
    const meanSquared = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;

    // Radice quadrata
    return Math.sqrt(meanSquared);
}

/**
 * Calcola la potenza LF (Low Frequency) e HF (High Frequency) usando FFT
 */
export function computeLfHf(
    ppiWindow: number[],
    sampleRateHz: number = 4.0
): { lf: number; hf: number } {
    if (ppiWindow.length < 10) {
        return { lf: 0, hf: 0 };
    }

    // 1) Interpola a una serie campionata uniformemente a sampleRateHz
    const n = Math.floor(ppiWindow.length * sampleRateHz / 1.0);
    const evenly: number[] = [];

    for (let i = 0; i < n; i++) {
        // Interpolazione lineare semplice
        const pos = (i * (ppiWindow.length - 1)) / (n - 1);
        const lo = Math.floor(pos);
        const hi = Math.min(lo + 1, ppiWindow.length - 1);
        const frac = pos - lo;
        evenly.push(ppiWindow[lo] * (1 - frac) + ppiWindow[hi] * frac);
    }

    // 2) Rimuovi la media (detrend)
    const mean = evenly.reduce((a, b) => a + b, 0) / evenly.length;
    const detrended = evenly.map((v) => v - mean);

    // 3) Zero-pad alla prossima potenza di 2
    let fftSize = 1;
    while (fftSize < n) {
        fftSize = fftSize << 1;
    }

    const fftInput = new Array(fftSize).fill(0);
    for (let i = 0; i < detrended.length; i++) {
        fftInput[i] = detrended[i];
    }

    // 4) Esegui FFT
    const fft = new FFT(fftSize);
    const out = fft.createComplexArray();
    fft.realTransform(out, fftInput);

    // 5) Calcola PSD: potenza = (Re^2 + Im^2) / (fs * N)
    const df = sampleRateHz / fftSize;
    const half = Math.floor(fftSize / 2);
    const psd: number[] = [];

    for (let k = 0; k < half; k++) {
        const re = out[2 * k];
        const im = out[2 * k + 1];
        psd.push((re * re + im * im) / (sampleRateHz * fftSize));
    }

    // 6) Integra nelle bande LF e HF
    let lf = 0;
    let hf = 0;

    for (let k = 0; k < psd.length; k++) {
        const freq = k * df;
        if (freq >= 0.04 && freq <= 0.15) {
            lf += psd[k] * df;
        }
        if (freq >= 0.15 && freq <= 0.4) {
            hf += psd[k] * df;
        }
    }

    return { lf, hf };
}

