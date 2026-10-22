/**
 * Build slim Polar Ably heartRate tick (schema v2).
 * Omits null / default fields to minimise DB storage.
 */

import type { LfHfStatus } from "@/features/hrv/core/hrv-calculator";
import type { PolarBeatTuple } from "@/features/hrv/ppi/beat-outbox";
import type { PolarHeartRateTickV2, PolarH10HeartRateTickV2 } from "./types";

export type BuildPolarHeartRateTickInput = {
  sid: string;
  hr: number;
  signalStale?: boolean;
  hrv?: number | null;
  lfPower?: number | null;
  hfPower?: number | null;
  lfHfStatus?: LfHfStatus | null;
  beats: PolarBeatTuple[];
  windowFromSeq?: number | null;
  /** Include CRC checkpoint this tick. */
  includeWindowCheckpoint?: boolean;
  windowCrc?: string | null;
  windowBeatCount?: number | null;
  blocker?: boolean | null;
  contactStatus?: boolean | null;
  skinTemperatureC?: number | null;
};

function positiveOrUndef(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}

function nonNegOrUndef(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function buildPolarHeartRateTick(
  input: BuildPolarHeartRateTickInput
): PolarHeartRateTickV2 {
  const signalStale = input.signalStale === true;
  if (signalStale) {
    return {
      sid: input.sid,
      hr: 0,
      signalStale: true,
      beats: [],
    };
  }

  const tick: PolarHeartRateTickV2 = {
    sid: input.sid,
    hr: input.hr,
    beats: input.beats,
  };

  const hrv = positiveOrUndef(input.hrv);
  if (hrv != null) tick.hrv = hrv;

  const lf = nonNegOrUndef(input.lfPower);
  const hf = nonNegOrUndef(input.hfPower);
  if (lf != null) tick.lfPower = lf;
  if (hf != null) tick.hfPower = hf;

  if (input.lfHfStatus != null && input.lfHfStatus !== "unavailable") {
    tick.lfHfStatus = input.lfHfStatus;
  }

  const fromSeq = nonNegOrUndef(input.windowFromSeq);
  if (fromSeq != null) tick.windowFromSeq = fromSeq;

  if (input.includeWindowCheckpoint) {
    if (input.windowCrc) tick.windowCrc = input.windowCrc;
    const count = nonNegOrUndef(input.windowBeatCount);
    if (count != null) tick.windowBeatCount = count;
  }

  if (input.blocker === true) tick.blocker = true;
  if (input.contactStatus === false) tick.contactStatus = false;

  const skin = positiveOrUndef(input.skinTemperatureC);
  if (skin != null) tick.skinTemperatureC = skin;

  return tick;
}

export type BuildPolarH10HeartRateTickInput = {
  sid: string;
  hr: number;
  signalStale?: boolean;
  hrv?: number | null;
  lfPower?: number | null;
  hfPower?: number | null;
  lfHfStatus?: LfHfStatus | null;
  rrsMs?: number[] | null;
};

export function buildPolarH10HeartRateTick(
  input: BuildPolarH10HeartRateTickInput
): PolarH10HeartRateTickV2 {
  if (input.signalStale === true) {
    return {
      sid: input.sid,
      hr: 0,
      signalStale: true,
      rrSource: "ecg_rr",
    };
  }
  const tick: PolarH10HeartRateTickV2 = {
    sid: input.sid,
    hr: input.hr,
    rrSource: "ecg_rr",
  };
  const hrv = positiveOrUndef(input.hrv);
  if (hrv != null) tick.hrv = hrv;
  const lf = nonNegOrUndef(input.lfPower);
  const hf = nonNegOrUndef(input.hfPower);
  if (lf != null) tick.lfPower = lf;
  if (hf != null) tick.hfPower = hf;
  if (input.lfHfStatus != null && input.lfHfStatus !== "unavailable") {
    tick.lfHfStatus = input.lfHfStatus;
  }
  if (input.rrsMs != null && input.rrsMs.length > 0) {
    tick.rrsMs = [...input.rrsMs];
  }
  return tick;
}
