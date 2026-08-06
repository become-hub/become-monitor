/**
 * Builds Polar live Ably `heartRate` payloads (360 / Loop).
 * Keeps RR/PPI/skin-temp contract in one place for streaming + periodic send.
 * Time is added by AblyService.sendMessage as `timestamp` (no duplicate `date`).
 */

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
  };
}
