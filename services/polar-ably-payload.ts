/**
 * Builds Polar live Ably `heartRate` payloads (360 / Loop).
 * Keeps RR/PPI/skin-temp contract in one place for streaming + periodic send.
 * Time is added by AblyService.sendMessage as `timestamp` (no duplicate `date`).
 */

import { APP_VERSION } from "@/constants/app-version";
import type { PolarProductId } from "@/features/devices/polar/polar-products";
import type { RrSource } from "./rr-interval";
import type {
  LfHfIntervalKind,
  LfHfStatus,
  TachogramSample,
} from "./hrv-calculator";
import type {
  HrvPreprocessingExport,
  PpiRejectReason,
} from "./ppi-sample-window";

export type PolarPpiSampleExport = {
  ppiMs: number;
  errorEstimate: number | null;
  timestamp: number;
  rejectReason?: PpiRejectReason;
  accepted?: boolean;
  kind?: LfHfIntervalKind;
  includedInTimeline?: boolean;
  includedInTachogram?: boolean;
  correctedPpiMs?: number | null;
};

export type PolarAblyHeartRateInput = {
  deviceId: string | null;
  /** Catalog product id (`PolarProductId`); null if unresolved. */
  deviceModel: PolarProductId | null;
  /**
   * Heart rate bpm. Normally > 0; may be 0 when `signalStale` is true
   * (latched Ably stream with lost sensor signal).
   */
  hr: number;
  /**
   * True when the Ably stream is latched but the live sensor signal is lost.
   * Forces HRV / LF/HF / PPI series to null regardless of other inputs.
   */
  signalStale?: boolean;
  /** Wall-clock ms since the current stale period started; null when not stale. */
  staleSinceMs?: number | null;
  hrv?: number | null;
  lfPower?: number | null;
  hfPower?: number | null;
  /** LF/HF ratio; null when invalid or hf is 0. */
  lfHfRatio?: number | null;
  /** True when lfPower/hfPower come from a ready 5 min PPI window. */
  lfHfValid?: boolean | null;
  /**
   * Trust grade of lfPower/hfPower. When set, powers are published for every
   * status except `unavailable`, even if `lfHfValid` is false.
   */
  lfHfStatus?: LfHfStatus | null;
  /** Accepted / raw PPI in the LF/HF window (live gate ≥ 0.60, valid ≥ 0.75). */
  lfHfAcceptedRatio?: number | null;
  /** Longest run of corrected beats in seconds (live gate ≤ 10, valid ≤ 5). */
  lfHfMaxArtifactGapSec?: number | null;
  /** Wall-clock ms when the LF/HF spectrum was last computed (not Live tick time). */
  lfHfComputedAt?: number | null;
  rrMs?: number | null;
  rrSource?: RrSource | null;
  /**
   * Raw PPI for this tick. Included only when `rrSource === "ppi"`.
   * If omitted while source is ppi, falls back to `rrMs`.
   */
  ppiMs?: number | null;
  /**
   * Corrected Y series for Hub compatibility (same as correctedPpiSeries).
   * Alone is NOT enough to recompute LF/HF — needs ppiTimesSec / tachogramSamples.
   */
  ppisMs?: number[] | null;
  /** Per-beat PPI with timestamp / errorEstimate (PPI source only). */
  ppiSamples?: PolarPpiSampleExport[] | null;
  /**
   * Explicit tachogram for external recompute: timeSec (X raw) + corrected Y.
   */
  tachogramSamples?: TachogramSample[] | null;
  /** Cumulative raw-included beat times (X). Same length as correctedPpiSeries. */
  ppiTimesSec?: number[] | null;
  /** Raw included PPI ms (accepted + quality_rejected). */
  rawIncludedPpiMs?: number[] | null;
  /** Corrected Y series (same length as ppiTimesSec). */
  correctedPpiSeries?: number[] | null;
  /** Uniform 4 Hz series fed to the FFT. */
  resampledSeries?: number[] | null;
  /** Sum of included raw PPI / 1000. */
  includedIntervalDurationSec?: number | null;
  /** ppiTimesSec[last] - ppiTimesSec[0]. */
  tachogramDomainSec?: number | null;
  /** Resample end − start (PSD domain). Prefer this over hrvWindowSeconds. */
  resampledDurationSec?: number | null;
  /** @deprecated alias of includedIntervalDurationSec for Hub compat. */
  hrvWindowSeconds?: number | null;
  /** Length of corrected series used for LF/HF (`ppisMs.length`). */
  hrvIntervalCount?: number | null;
  hrvMethod?: "periodogram" | null;
  hrvSamplingHz?: number | null;
  /** Live publish rate (1 Hz) — not the tachogram sample rate. */
  livePublishHz?: number | null;
  peakFrequencyHz?: number | null;
  lfBandHz?: [number, number] | null;
  hfBandHz?: [number, number] | null;
  hrvPreprocessing?: HrvPreprocessingExport | null;
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
  /** From BLE HR sample, overridden when PPI series is published. */
  rrAvailable?: boolean | null;
  /** From BLE HR sample, overridden when PPI series is published. */
  rrsMs?: number[] | null;
};

export type PolarAblyHeartRatePayload = {
  deviceId: string | null;
  deviceModel: PolarProductId | null;
  hr: number;
  signalStale: boolean;
  staleSinceMs: number | null;
  hrv: number | null;
  lfPower: number | null;
  hfPower: number | null;
  lfHfRatio: number | null;
  lfHfValid: boolean | null;
  lfHfStatus: LfHfStatus | null;
  lfHfAcceptedRatio: number | null;
  lfHfMaxArtifactGapSec: number | null;
  lfHfComputedAt: number | null;
  rrMs: number | null;
  rrSource: RrSource | null;
  ppiMs: number | null;
  ppisMs: number[] | null;
  ppiSamples: PolarPpiSampleExport[] | null;
  tachogramSamples: TachogramSample[] | null;
  ppiTimesSec: number[] | null;
  rawIncludedPpiMs: number[] | null;
  correctedPpiSeries: number[] | null;
  resampledSeries: number[] | null;
  includedIntervalDurationSec: number | null;
  tachogramDomainSec: number | null;
  resampledDurationSec: number | null;
  hrvWindowSeconds: number | null;
  hrvIntervalCount: number | null;
  hrvMethod: "periodogram" | null;
  hrvSamplingHz: number | null;
  livePublishHz: number | null;
  peakFrequencyHz: number | null;
  lfBandHz: [number, number] | null;
  hfBandHz: [number, number] | null;
  hrvPreprocessing: HrvPreprocessingExport | null;
  skinTemperatureC: number | null;
  contactStatus: boolean | null;
  contactStatusSupported: boolean | null;
  errorEstimate: number | null;
  blocker: boolean | null;
  ppgQuality: number | null;
  correctedHr: number | null;
  rrAvailable: boolean | null;
  rrsMs: number[] | null;
  /**
   * Series dropped to fit the Ably per-message limit (65 536 B). Null when the
   * full payload fit. Dropped keys are sent as null.
   */
  payloadTrimmed: string[] | null;
  /** Marketing version, e.g. `v1.2.2`. */
  appVersion: string;
};

/**
 * Soft budget for the serialized heartRate payload. Ably rejects publishes
 * above 65 536 B (code 40009); sendMessage adds ~150 B of envelope fields.
 */
export const ABLY_HEART_RATE_MAX_PAYLOAD_BYTES = 60_000;

/**
 * Series dropped first (heaviest / most redundant), one at a time, until the
 * payload fits. Core fields (hr, hrv, LF/HF, ppisMs) are only dropped last.
 */
const PAYLOAD_TRIM_ORDER = [
  "resampledSeries", // 4 Hz FFT input — derivable from the tachogram
  "ppiSamples", // per-beat diagnostics
  "rawIncludedPpiMs",
  "rrsMs", // duplicate of ppisMs
  "tachogramSamples", // duplicate of ppiTimesSec + correctedPpiSeries
  "correctedPpiSeries", // duplicate of ppisMs
  "ppiTimesSec",
  "ppisMs",
] as const satisfies ReadonlyArray<keyof PolarAblyHeartRatePayload>;

/** Drops series in `PAYLOAD_TRIM_ORDER` until the JSON fits `maxBytes`. */
export function fitPolarAblyPayloadToLimit(
  payload: PolarAblyHeartRatePayload,
  maxBytes: number = ABLY_HEART_RATE_MAX_PAYLOAD_BYTES
): PolarAblyHeartRatePayload {
  if (JSON.stringify(payload).length <= maxBytes) {
    return payload;
  }
  const trimmed: string[] = [];
  const result: PolarAblyHeartRatePayload = { ...payload };
  for (const key of PAYLOAD_TRIM_ORDER) {
    if (result[key] == null) {
      continue;
    }
    (result as Record<string, unknown>)[key] = null;
    trimmed.push(key);
    result.payloadTrimmed = [...trimmed];
    if (JSON.stringify(result).length <= maxBytes) {
      break;
    }
  }
  return result;
}

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

function copyNumberArray(
  values: number[] | null | undefined
): number[] | null {
  return values != null && values.length > 0 ? [...values] : null;
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
  const signalStale = input.signalStale === true;
  const staleSinceMs = signalStale
    ? nonNegativeOrNull(input.staleSinceMs)
    : null;

  if (signalStale) {
    return {
      deviceId: input.deviceId,
      deviceModel: input.deviceModel,
      hr: 0,
      signalStale: true,
      staleSinceMs,
      hrv: null,
      lfPower: null,
      hfPower: null,
      lfHfRatio: null,
      lfHfValid: null,
      lfHfStatus: "unavailable",
      lfHfAcceptedRatio: null,
      lfHfMaxArtifactGapSec: null,
      lfHfComputedAt: null,
      rrMs: null,
      rrSource: null,
      ppiMs: null,
      ppisMs: null,
      ppiSamples: null,
      tachogramSamples: null,
      ppiTimesSec: null,
      rawIncludedPpiMs: null,
      correctedPpiSeries: null,
      resampledSeries: null,
      includedIntervalDurationSec: null,
      tachogramDomainSec: null,
      resampledDurationSec: null,
      hrvWindowSeconds: null,
      hrvIntervalCount: null,
      hrvMethod: null,
      hrvSamplingHz: null,
      livePublishHz: 1,
      peakFrequencyHz: null,
      lfBandHz: null,
      hfBandHz: null,
      hrvPreprocessing: null,
      skinTemperatureC: null,
      contactStatus: boolOrNull(input.contactStatus),
      contactStatusSupported: boolOrNull(input.contactStatusSupported),
      errorEstimate: nonNegativeOrNull(input.errorEstimate),
      blocker: boolOrNull(input.blocker),
      ppgQuality: positiveOrNull(input.ppgQuality),
      correctedHr: null,
      rrAvailable: null,
      rrsMs: null,
      payloadTrimmed: null,
      appVersion: `v${APP_VERSION}`,
    };
  }

  const rrSource = input.rrSource ?? null;
  const rrMs = positiveOrNull(input.rrMs);
  const ppiMs =
    rrSource === "ppi"
      ? positiveOrNull(input.ppiMs ?? input.rrMs)
      : null;

  const ppisFromInput = copyNumberArray(input.ppisMs);
  const hrRrsMs = copyNumberArray(input.rrsMs);

  let ppisMs: number[] | null = null;
  let rrsMs: number[] | null = null;
  let rrAvailable: boolean | null = boolOrNull(input.rrAvailable);
  let ppiSamples: PolarPpiSampleExport[] | null = null;

  let tachogramSamples: TachogramSample[] | null = null;
  let ppiTimesSec: number[] | null = null;
  let rawIncludedPpiMs: number[] | null = null;
  let correctedPpiSeries: number[] | null = null;
  let resampledSeries: number[] | null = null;
  let includedIntervalDurationSec: number | null = null;
  let tachogramDomainSec: number | null = null;
  let resampledDurationSec: number | null = null;
  let livePublishHz: number | null = null;
  let lfHfComputedAt: number | null = null;

  if (rrSource === "ppi") {
    ppisMs = ppisFromInput;
    // Corrected Y for Hub — never fabricate from scalar ppiMs. Alone ≠ recompute LF/HF.
    rrsMs = ppisFromInput != null ? [...ppisFromInput] : null;
    rrAvailable = rrsMs != null && rrsMs.length >= 2;
    ppiSamples =
      input.ppiSamples != null && input.ppiSamples.length > 0
        ? input.ppiSamples.map((s) => ({ ...s }))
        : null;
    tachogramSamples =
      input.tachogramSamples != null && input.tachogramSamples.length > 0
        ? input.tachogramSamples.map((s) => ({ ...s }))
        : null;
    ppiTimesSec = copyNumberArray(input.ppiTimesSec);
    rawIncludedPpiMs = copyNumberArray(input.rawIncludedPpiMs);
    correctedPpiSeries = copyNumberArray(input.correctedPpiSeries);
    resampledSeries = copyNumberArray(input.resampledSeries);
    includedIntervalDurationSec = nonNegativeOrNull(
      input.includedIntervalDurationSec ?? input.hrvWindowSeconds
    );
    tachogramDomainSec = nonNegativeOrNull(input.tachogramDomainSec);
    resampledDurationSec = nonNegativeOrNull(input.resampledDurationSec);
    livePublishHz = positiveOrNull(input.livePublishHz ?? 1);
    lfHfComputedAt = nonNegativeOrNull(input.lfHfComputedAt);
  } else if (rrSource === "ecg_rr") {
    ppisMs = null;
    ppiSamples = null;
    tachogramSamples = null;
    ppiTimesSec = null;
    rawIncludedPpiMs = null;
    correctedPpiSeries = null;
    resampledSeries = null;
    rrsMs = hrRrsMs;
    if (rrAvailable == null) {
      rrAvailable = rrsMs != null && rrsMs.length >= 2;
    }
  } else {
    // hr_derived or unknown: do not fill rrsMs from PPI window.
    ppisMs = null;
    ppiSamples = null;
    tachogramSamples = null;
    ppiTimesSec = null;
    rawIncludedPpiMs = null;
    correctedPpiSeries = null;
    resampledSeries = null;
    rrsMs = hrRrsMs;
  }

  const lfHfValid = boolOrNull(input.lfHfValid);
  const lfHfStatus = input.lfHfStatus ?? null;
  // With a status, only `unavailable` hides powers. Without one, legacy rules:
  // lfHfValid=false → null, true → allow 0, unset → positiveOrNull.
  const hidden =
    lfHfStatus != null ? lfHfStatus === "unavailable" : lfHfValid === false;
  const allowZero = lfHfStatus != null || lfHfValid === true;
  const powerOrNull = (value: number | null | undefined): number | null => {
    if (hidden || value == null || !Number.isFinite(value)) {
      return null;
    }
    if (allowZero) {
      return value >= 0 ? value : null;
    }
    return value > 0 ? value : null;
  };
  const lfPower = powerOrNull(input.lfPower);
  const hfPower = powerOrNull(input.hfPower);
  const lfHfRatio = hidden ? null : positiveOrNull(input.lfHfRatio);

  return fitPolarAblyPayloadToLimit({
    deviceId: input.deviceId,
    deviceModel: input.deviceModel,
    hr: input.hr,
    signalStale: false,
    staleSinceMs: null,
    hrv: positiveOrNull(input.hrv),
    lfPower,
    hfPower,
    lfHfRatio,
    lfHfValid,
    lfHfStatus,
    lfHfAcceptedRatio: nonNegativeOrNull(input.lfHfAcceptedRatio),
    lfHfMaxArtifactGapSec: nonNegativeOrNull(input.lfHfMaxArtifactGapSec),
    lfHfComputedAt,
    rrMs,
    rrSource,
    ppiMs,
    ppisMs,
    ppiSamples,
    tachogramSamples,
    ppiTimesSec,
    rawIncludedPpiMs,
    correctedPpiSeries,
    resampledSeries,
    includedIntervalDurationSec,
    tachogramDomainSec,
    resampledDurationSec,
    hrvWindowSeconds:
      includedIntervalDurationSec ??
      nonNegativeOrNull(input.hrvWindowSeconds),
    hrvIntervalCount: nonNegativeOrNull(input.hrvIntervalCount),
    hrvMethod: input.hrvMethod ?? null,
    hrvSamplingHz: positiveOrNull(input.hrvSamplingHz),
    livePublishHz,
    peakFrequencyHz: nonNegativeOrNull(input.peakFrequencyHz),
    lfBandHz: input.lfBandHz ?? null,
    hfBandHz: input.hfBandHz ?? null,
    hrvPreprocessing: input.hrvPreprocessing ?? null,
    skinTemperatureC: positiveOrNull(input.skinTemperatureC),
    contactStatus: boolOrNull(input.contactStatus),
    contactStatusSupported: boolOrNull(input.contactStatusSupported),
    errorEstimate: nonNegativeOrNull(input.errorEstimate),
    blocker: boolOrNull(input.blocker),
    ppgQuality: positiveOrNull(input.ppgQuality),
    correctedHr: positiveOrNull(input.correctedHr),
    rrAvailable,
    rrsMs,
    payloadTrimmed: null,
    appVersion: `v${APP_VERSION}`,
  });
}
