/**
 * Physiological PPI limits and RMSSD quality gate.
 * Shared by the PPI window, HRV analysis mode, and Monitor live-signal policy.
 */

export const MIN_PPI_MS = 300;
export const MAX_PPI_MS = 2000;

/** Max errorEstimate (ms) allowed into the HRV / LF / HF window (sane samples only). */
export const PPI_ERROR_ESTIMATE_SANE_MS = 10;

export function isUsablePpiMs(ppiMs: number): boolean {
  return Number.isFinite(ppiMs) && ppiMs >= MIN_PPI_MS && ppiMs <= MAX_PPI_MS;
}

/**
 * Whether this PPI sample may update the HRV / LF / HF window.
 * Only low errorEstimate (≤ PPI_ERROR_ESTIMATE_SANE_MS) is treated as sane
 * enough for the FFT; noisier intervals keep the last sane metrics even if
 * the Errore PPI card is not red yet (red stays at > 30 ms).
 */
export function shouldUpdateLfHfFromPpiSample(sample: {
  errorEstimate?: number | null;
}): boolean {
  const errorEstimate = sample.errorEstimate ?? null;
  if (errorEstimate == null) {
    return true;
  }
  return errorEstimate <= PPI_ERROR_ESTIMATE_SANE_MS;
}
