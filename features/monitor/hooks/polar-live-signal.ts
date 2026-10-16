/**
 * Polar live-stream policy (360 / Loop): usable PPI, freshness, HR=0 dropout,
 * and wear / signal-quality heuristics for Monitor UI.
 */

import {
  resolvePolarContact,
  type PolarHrExtrasStash,
  type PolarPpiExtrasStash,
} from "@/services/polar-ably-payload";

export const MIN_PPI_MS = 300;
export const MAX_PPI_MS = 2000;
export const PPI_STALE_MS = 4000;
export const PPI_STREAM_ALIVE_MS = 8000;
export const HR_ZERO_GRACE_MS = 10000;
/** Polar docs: errorEstimate over ~30 ms often means motion or poor skin contact. */
export const PPI_ERROR_ESTIMATE_POOR_MS = 30;

export type PolarSignalQualityUi = {
  contactStatus: boolean | null;
  contactStatusSupported: boolean | null;
  errorEstimate: number | null;
  blocker: boolean | null;
  ppgQuality: number | null;
};

export const EMPTY_POLAR_SIGNAL_QUALITY: PolarSignalQualityUi = {
  contactStatus: null,
  contactStatusSupported: null,
  errorEstimate: null,
  blocker: null,
  ppgQuality: null,
};

export function isUsablePpiMs(ppiMs: number): boolean {
  return Number.isFinite(ppiMs) && ppiMs >= MIN_PPI_MS && ppiMs <= MAX_PPI_MS;
}

/** Build Monitor UI quality snapshot from PPI + HR stashes. */
export function buildPolarSignalQualityUi(
  ppi: PolarPpiExtrasStash | null | undefined,
  hr: PolarHrExtrasStash | null | undefined
): PolarSignalQualityUi {
  const contact = resolvePolarContact(ppi, hr);
  return {
    contactStatus: contact.contactStatus,
    contactStatusSupported: contact.contactStatusSupported,
    errorEstimate: ppi?.errorEstimate ?? null,
    blocker: ppi?.blocker ?? null,
    ppgQuality: hr?.ppgQuality ?? null,
  };
}

/** No reliable skin contact (when the device reports contact support). */
export function isPolarSkinContactPoor(
  quality: PolarSignalQualityUi | null | undefined
): boolean {
  return (
    quality?.contactStatusSupported === true &&
    quality.contactStatus === false
  );
}

/** Motion artefact / PPI blocker active. */
export function isPolarMotionPoor(
  quality: PolarSignalQualityUi | null | undefined
): boolean {
  return quality?.blocker === true;
}

/** High PPI error estimate (loose fit or noise; not the same as motion blocker). */
export function isPolarPpiErrorPoor(
  quality: PolarSignalQualityUi | null | undefined
): boolean {
  return (
    quality?.errorEstimate != null &&
    quality.errorEstimate > PPI_ERROR_ESTIMATE_POOR_MS
  );
}

/**
 * True when any wear/signal warning should appear
 * (skin contact, motion, or high PPI error estimate).
 */
export function isPolarWearQualityPoor(
  quality: PolarSignalQualityUi | null | undefined
): boolean {
  return (
    isPolarSkinContactPoor(quality) ||
    isPolarMotionPoor(quality) ||
    isPolarPpiErrorPoor(quality)
  );
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
