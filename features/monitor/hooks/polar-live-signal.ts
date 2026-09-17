/**
 * Polar live-stream policy (360 / Loop): usable PPI, freshness, HR=0 dropout.
 */

export const MIN_PPI_MS = 300;
export const MAX_PPI_MS = 2000;
export const PPI_STALE_MS = 4000;
export const PPI_STREAM_ALIVE_MS = 8000;
export const HR_ZERO_GRACE_MS = 10000;

export function isUsablePpiMs(ppiMs: number): boolean {
  return Number.isFinite(ppiMs) && ppiMs >= MIN_PPI_MS && ppiMs <= MAX_PPI_MS;
}

export function isFresh(
  timestampMs: number,
  nowMs: number,
  windowMs: number
): boolean {
  return timestampMs > 0 && nowMs - timestampMs < windowMs;
}

export function isSustainedHrZero(
  hrZeroSince: number,
  nowMs: number,
  graceMs: number = HR_ZERO_GRACE_MS
): boolean {
  return hrZeroSince > 0 && nowMs - hrZeroSince >= graceMs;
}
