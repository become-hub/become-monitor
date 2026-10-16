/**
 * Builds Polar live Ably `heartRate` payloads (360 / Loop).
 * Keeps RR/PPI/skin-temp contract in one place for streaming + periodic send.
 * Time is added by AblyService.sendMessage as `timestamp` (no duplicate `date`).
 */

import { APP_VERSION } from "@/constants/app-version";
import type { PolarProductId } from "@/features/devices/polar/polar-products";
import type { RrSource } from "./rr-interval";

export type PolarAblyHeartRateInput = {
  deviceId: string | null;
  /** Catalog product id (`PolarProductId`); null if unresolved. */
  deviceModel: PolarProductId | null;
  /** Heart rate bpm (> 0 expected by callers before send). */
  hr: number;
  hrv?: number | null;
  lfPower?: number | null;
  hfPower?: number | null;
  rrMs?: number | null;
  rrSource?: RrSource | null;
  /**
   * Raw PPI for this tick. Included only when `rrSource === "ppi"`.
   * If omitted while source is ppi, falls back to `rrMs`.
   */
  ppiMs?: number | null;
  /** Loop Gen 2 skin temp °C; always null on 360 / when absent. */
  skinTemperatureC?: number | null;
  /** Prefer PPI skin contact when supported; else HR notification contact. */
  contactStatus?: boolean | null;
  contactStatusSupported?: boolean | null;
  /** PPI quality: absolute error estimate in ms. */
  errorEstimate?: number | null;
  /** PPI movement / invalid flag. */
  blocker?: boolean | null;
  /** From BLE HR sample; null when 0 / unavailable. */
  ppgQuality?: number | null;
  /** From BLE HR sample; null when 0 / unavailable. */
  correctedHr?: number | null;
  /** From BLE HR sample. */
  rrAvailable?: boolean | null;
  /** From BLE HR sample; null when empty. */
  rrsMs?: number[] | null;
};

export type PolarAblyHeartRatePayload = {
  deviceId: string | null;
  deviceModel: PolarProductId | null;
  hr: number;
  hrv: number | null;
  lfPower: number | null;
  hfPower: number | null;
  rrMs: number | null;
  rrSource: RrSource | null;
  ppiMs: number | null;
  skinTemperatureC: number | null;
  contactStatus: boolean | null;
  contactStatusSupported: boolean | null;
  errorEstimate: number | null;
  blocker: boolean | null;
  ppgQuality: number | null;
  correctedHr: number | null;
  rrAvailable: boolean | null;
  rrsMs: number[] | null;
  /** Marketing version, e.g. `v1.2.2`. */
  appVersion: string;
};

/** Latest PPI quality / contact fields kept for periodic Ably ticks. */
export type PolarPpiExtrasStash = {
  errorEstimate: number | null;
  blocker: boolean | null;
  skinContactStatus: boolean | null;
  skinContactSupported: boolean | null;
};

/** Latest BLE HR notification extras (often empty on 360/Loop with PPI active). */
export type PolarHrExtrasStash = {
  ppgQuality: number | null;
  correctedHr: number | null;
  rrAvailable: boolean | null;
  rrsMs: number[] | null;
  contactDetected: boolean | null;
  contactSupported: boolean | null;
};

export const EMPTY_POLAR_PPI_EXTRAS: PolarPpiExtrasStash = {
  errorEstimate: null,
  blocker: null,
  skinContactStatus: null,
  skinContactSupported: null,
};

export const EMPTY_POLAR_HR_EXTRAS: PolarHrExtrasStash = {
  ppgQuality: null,
  correctedHr: null,
  rrAvailable: null,
  rrsMs: null,
  contactDetected: null,
  contactSupported: null,
};

function positiveOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegativeOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

function boolOrNull(value: boolean | null | undefined): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/**
 * Prefer PPI skin contact when the sample supports it; otherwise HR notification contact.
 */
export function resolvePolarContact(
  ppi: Pick<
    PolarPpiExtrasStash,
    "skinContactStatus" | "skinContactSupported"
  > | null | undefined,
  hr: Pick<PolarHrExtrasStash, "contactDetected" | "contactSupported"> | null | undefined
): {
  contactStatus: boolean | null;
  contactStatusSupported: boolean | null;
} {
  if (ppi?.skinContactSupported === true) {
    return {
      contactStatus: boolOrNull(ppi.skinContactStatus),
      contactStatusSupported: true,
    };
  }
  if (hr?.contactSupported === true) {
    return {
      contactStatus: boolOrNull(hr.contactDetected),
      contactStatusSupported: true,
    };
  }
  const supported =
    boolOrNull(ppi?.skinContactSupported) ?? boolOrNull(hr?.contactSupported);
  const status =
    boolOrNull(ppi?.skinContactStatus) ?? boolOrNull(hr?.contactDetected);
  return {
    contactStatus: status,
    contactStatusSupported: supported,
  };
}

export function stashPolarHrExtras(data: {
  ppgQuality?: number;
  correctedHr?: number;
  rrAvailable?: boolean;
  rrsMs?: number[];
  contactDetected?: boolean;
  contactSupported?: boolean;
}): PolarHrExtrasStash {
  return {
    ppgQuality: positiveOrNull(data.ppgQuality),
    correctedHr: positiveOrNull(data.correctedHr),
    rrAvailable: boolOrNull(data.rrAvailable),
    rrsMs:
      data.rrsMs != null && data.rrsMs.length > 0 ? [...data.rrsMs] : null,
    contactDetected: boolOrNull(data.contactDetected),
    contactSupported: boolOrNull(data.contactSupported),
  };
}

export function stashPolarPpiExtras(sample: {
  errorEstimate?: number;
  blocker?: boolean;
  skinContactStatus?: boolean;
  skinContactSupported?: boolean;
}): PolarPpiExtrasStash {
  return {
    errorEstimate: nonNegativeOrNull(sample.errorEstimate),
    blocker: boolOrNull(sample.blocker),
    skinContactStatus: boolOrNull(sample.skinContactStatus),
    skinContactSupported: boolOrNull(sample.skinContactSupported),
  };
}

/** Merge PPI + HR stashes into Ably extras (contact prefers PPI when supported). */
export function polarExtrasFromStash(
  ppi: PolarPpiExtrasStash | null | undefined,
  hr: PolarHrExtrasStash | null | undefined
): Pick<
  PolarAblyHeartRateInput,
  | "contactStatus"
  | "contactStatusSupported"
  | "errorEstimate"
  | "blocker"
  | "ppgQuality"
  | "correctedHr"
  | "rrAvailable"
  | "rrsMs"
> {
  const contact = resolvePolarContact(ppi, hr);
  return {
    ...contact,
    errorEstimate: ppi?.errorEstimate ?? null,
    blocker: ppi?.blocker ?? null,
    ppgQuality: hr?.ppgQuality ?? null,
    correctedHr: hr?.correctedHr ?? null,
    rrAvailable: hr?.rrAvailable ?? null,
    rrsMs: hr?.rrsMs ?? null,
  };
}

export function buildPolarAblyHeartRatePayload(
  input: PolarAblyHeartRateInput
): PolarAblyHeartRatePayload {
  const rrSource = input.rrSource ?? null;
  const rrMs = positiveOrNull(input.rrMs);
  const ppiMs =
    rrSource === "ppi"
      ? positiveOrNull(input.ppiMs ?? input.rrMs)
      : null;
  const rrsMs =
    input.rrsMs != null && input.rrsMs.length > 0 ? [...input.rrsMs] : null;

  return {
    deviceId: input.deviceId,
    deviceModel: input.deviceModel,
    hr: input.hr,
    hrv: positiveOrNull(input.hrv),
    lfPower: positiveOrNull(input.lfPower),
    hfPower: positiveOrNull(input.hfPower),
    rrMs,
    rrSource,
    ppiMs,
    skinTemperatureC: positiveOrNull(input.skinTemperatureC),
    contactStatus: boolOrNull(input.contactStatus),
    contactStatusSupported: boolOrNull(input.contactStatusSupported),
    errorEstimate: nonNegativeOrNull(input.errorEstimate),
    blocker: boolOrNull(input.blocker),
    ppgQuality: positiveOrNull(input.ppgQuality),
    correctedHr: positiveOrNull(input.correctedHr),
    rrAvailable: boolOrNull(input.rrAvailable),
    rrsMs,
    appVersion: `v${APP_VERSION}`,
  };
}
