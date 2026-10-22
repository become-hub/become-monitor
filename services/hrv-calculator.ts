/**
 * HRV Calculator
 * Calcola metriche HRV (RMSSD) e analisi della frequenza (LF/HF) usando FFT
 */

import FFT from "fft.js";

/** Same cap as RMSSD successive-diff filter (ms). */
export const MAX_SUCCESSIVE_DIFF_MS = 200;

/**
 * Calcola RMSSD (Root Mean Square of Successive Differences) da una finestra di valori PPI
 */
export function calculateRMSSD(ppiWindow: number[]): number {
    if (ppiWindow.length < 2) return 0;

    // Calcola le differenze successive
    const diffs = [];
    for (let i = 0; i < ppiWindow.length - 1; i++) {
        const diff = ppiWindow[i + 1] - ppiWindow[i];
        // Filtra artefatti grandi
        if (Math.abs(diff) < MAX_SUCCESSIVE_DIFF_MS) {
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
 * Sostituisce i campioni con salto ≥ MAX_SUCCESSIVE_DIFF_MS rispetto all’ultimo
 * intervallo accettato. Il posto nella finestra resta; il valore viene interpolato
 * tra i vicini validi (in testa/coda: nearest accepted).
 *
 * RMSSD ignora già queste differenze successive. Lasciarle nella FFT eleva al
 * quadrato l’ampiezza e porta LF/HF a migliaia di ms² con un HRV ancora normale.
 * Per questo il campione viene sostituito, non concatenato.
 *
 * @returns serie ripulita, o `null` se restano meno di 10 intervalli accettati
 */
export function replaceSuccessiveJumpArtifacts(
    ppiWindow: number[]
): number[] | null {
    if (ppiWindow.length === 0) {
        return null;
    }

    const acceptedIndices: number[] = [];
    let lastAccepted: number | null = null;

    for (let i = 0; i < ppiWindow.length; i++) {
        const value = ppiWindow[i];
        if (
            lastAccepted === null ||
            Math.abs(value - lastAccepted) < MAX_SUCCESSIVE_DIFF_MS
        ) {
            acceptedIndices.push(i);
            lastAccepted = value;
        }
    }

    if (acceptedIndices.length < 10) {
        return null;
    }

    const cleaned = new Array<number>(ppiWindow.length);
    let acceptedCursor = 0;

    for (let i = 0; i < ppiWindow.length; i++) {
        while (
            acceptedCursor < acceptedIndices.length - 1 &&
            acceptedIndices[acceptedCursor + 1] <= i
        ) {
            acceptedCursor += 1;
        }

        const leftIdx = acceptedIndices[acceptedCursor];
        if (leftIdx === i) {
            cleaned[i] = ppiWindow[i];
            continue;
        }

        const rightIdx =
            acceptedCursor + 1 < acceptedIndices.length
                ? acceptedIndices[acceptedCursor + 1]
                : leftIdx;

        if (i < leftIdx) {
            cleaned[i] = ppiWindow[leftIdx];
            continue;
        }

        if (rightIdx === leftIdx || i > rightIdx) {
            cleaned[i] = ppiWindow[leftIdx];
            continue;
        }

        const span = rightIdx - leftIdx;
        const frac = (i - leftIdx) / span;
        cleaned[i] =
            ppiWindow[leftIdx] * (1 - frac) + ppiWindow[rightIdx] * frac;
    }

    return cleaned;
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

    // Vedi commento su replaceSuccessiveJumpArtifacts: allinea LF/HF al filtro RMSSD.
    const series = replaceSuccessiveJumpArtifacts(ppiWindow);
    if (!series) {
        return { lf: 0, hf: 0 };
    }

    // 1) Interpola a una serie campionata uniformemente a sampleRateHz
    const n = Math.floor(series.length * sampleRateHz / 1.0);
    const evenly: number[] = [];

    for (let i = 0; i < n; i++) {
        // Interpolazione lineare semplice
        const pos = (i * (series.length - 1)) / (n - 1);
        const lo = Math.floor(pos);
        const hi = Math.min(lo + 1, series.length - 1);
        const frac = pos - lo;
        evenly.push(series[lo] * (1 - frac) + series[hi] * frac);
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
