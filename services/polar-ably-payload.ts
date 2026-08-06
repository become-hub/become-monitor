/**
 * Builds Polar live Ably `heartRate` payloads (360 / Loop).
 * Keeps RR/PPI/skin-temp contract in one place for streaming + periodic send.
 */

import type { RrSource } from "./rr-interval";

export type PolarAblyHeartRateInput = {
  deviceId: string | null;
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
  date: string;
  /** Stream callbacks historically use `heartRate`; periodic sender uses `hr`. */
  hrField?: "hr" | "heartRate";
};

export type PolarAblyHeartRatePayload = {
  deviceId: string | null;
  hr?: number;
  heartRate?: number;
  hrv: number | null;
  lfPower: number | null;
  hfPower: number | null;
  rrMs: number | null;
  rrSource: RrSource | null;
  ppiMs: number | null;
  skinTemperatureC: number | null;
  date: string;
};

function positiveOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
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

  const payload: PolarAblyHeartRatePayload = {
    deviceId: input.deviceId,
    hrv: positiveOrNull(input.hrv),
    lfPower: positiveOrNull(input.lfPower),
    hfPower: positiveOrNull(input.hfPower),
    rrMs,
    rrSource,
    ppiMs,
    skinTemperatureC: positiveOrNull(input.skinTemperatureC),
    date: input.date,
  };

  if (input.hrField === "heartRate") {
    payload.heartRate = input.hr;
  } else {
    payload.hr = input.hr;
  }

  return payload;
}
