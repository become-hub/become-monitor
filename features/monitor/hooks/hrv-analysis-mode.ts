/**
 * HRV analysis modes for Monitor: short live window (client) vs 5 min epoch (clinical).
 * Math stays in hrv-calculator; this module owns acceptance, epoch length, and publish readiness.
 */

import {
  isUsablePpiMs,
  shouldUpdateLfHfFromPpiSample,
} from "./polar-live-signal";

export type HrvAnalysisMode = "client" | "clinical";

/** Interval source feeding the HRV window / epoch. */
export type HrvIntervalSource = "ppi" | "ecg_rr" | "hr_derived";

/** Client mode: rolling window of accepted beats (current product behaviour). */
export const CLIENT_WINDOW_INTERVALS = 30;

/** Clinical short-term spectral epoch (Task Force–style duration). */
export const CLINICAL_EPOCH_TARGET_MS = 300_000;

/** Wall-clock cap to gather a clean 5 min epoch before resetting as invalid. */
export const CLINICAL_ACQUISITION_TIMEOUT_MS = 480_000;

export type HrvSampleForAccept = {
  intervalMs: number;
  errorEstimate?: number | null;
  blocker?: boolean | null;
};

export type HrvAnalysisPolicy = {
  mode: HrvAnalysisMode;
  source: HrvIntervalSource;
  /** Client: fixed beat count. Clinical: null (duration-based). */
  windowIntervalCount: number | null;
  /** Clinical: required sum of accepted interval durations. Client: null. */
  epochTargetMs: number | null;
  /** Clinical: wall-clock timeout to reach epochTargetMs. Client: null. */
  acquisitionTimeoutMs: number | null;
  /** HR-derived RR may enter the window only in client mode. */
  allowHrDerived: boolean;
};

export type HrvEpochAccumulator = {
  intervals: number[];
  acceptedDurationMs: number;
  wallClockStartedAt: number | null;
};

export type HrvPushResult = {
  accumulator: HrvEpochAccumulator;
  shouldCompute: boolean;
  /** True when clinical acquisition timed out without a full epoch. */
  epochTimedOut: boolean;
};

export function createEmptyHrvEpochAccumulator(): HrvEpochAccumulator {
  return {
    intervals: [],
    acceptedDurationMs: 0,
    wallClockStartedAt: null,
  };
}

/** Start wall-clock on first acquisition tick (even if the sample is rejected). */
export function markHrvAcquisitionStarted(
  accumulator: HrvEpochAccumulator,
  nowMs: number = Date.now()
): HrvEpochAccumulator {
  if (accumulator.wallClockStartedAt != null) {
    return accumulator;
  }
  return {
    ...accumulator,
    wallClockStartedAt: nowMs,
  };
}

export function hrvWallElapsedMs(
  accumulator: HrvEpochAccumulator,
  nowMs: number = Date.now()
): number {
  if (accumulator.wallClockStartedAt == null) {
    return 0;
  }
  return Math.max(0, nowMs - accumulator.wallClockStartedAt);
}

/** True when clinical acquisition ran out of wall-clock time without a full epoch. */
export function isHrvAcquisitionTimedOut(
  accumulator: HrvEpochAccumulator,
  timeoutMs: number = CLINICAL_ACQUISITION_TIMEOUT_MS,
  nowMs: number = Date.now()
): boolean {
  if (accumulator.wallClockStartedAt == null) {
    return false;
  }
  return nowMs - accumulator.wallClockStartedAt >= timeoutMs;
}

export function getHrvAnalysisPolicy(
  mode: HrvAnalysisMode,
  source: HrvIntervalSource
): HrvAnalysisPolicy {
  if (mode === "clinical") {
    return {
      mode,
      source,
      windowIntervalCount: null,
      epochTargetMs: CLINICAL_EPOCH_TARGET_MS,
      acquisitionTimeoutMs: CLINICAL_ACQUISITION_TIMEOUT_MS,
      allowHrDerived: false,
    };
  }
  return {
    mode,
    source,
    windowIntervalCount: CLIENT_WINDOW_INTERVALS,
    epochTargetMs: null,
    acquisitionTimeoutMs: null,
    allowHrDerived: source !== "ecg_rr",
  };
}

/**
 * Whether an interval may enter the HRV window / clinical epoch.
 * Range check is always applied; PPI quality gates depend on mode.
 */
export function acceptHrvIntervalSample(
  mode: HrvAnalysisMode,
  source: HrvIntervalSource,
  sample: HrvSampleForAccept
): boolean {
  if (!isUsablePpiMs(sample.intervalMs)) {
    return false;
  }

  if (source === "hr_derived") {
    return mode === "client";
  }

  if (source === "ecg_rr") {
    return true;
  }

  // PPI (360 / Loop)
  if (!shouldUpdateLfHfFromPpiSample(sample)) {
    return false;
  }
  if (mode === "clinical" && sample.blocker === true) {
    return false;
  }
  return true;
}

/**
 * Push one accepted interval into the accumulator.
 * Caller must already have passed acceptHrvIntervalSample.
 */
export function pushHrvInterval(
  accumulator: HrvEpochAccumulator,
  policy: HrvAnalysisPolicy,
  intervalMs: number,
  nowMs: number = Date.now()
): HrvPushResult {
  if (policy.mode === "client") {
    const windowSize = policy.windowIntervalCount ?? CLIENT_WINDOW_INTERVALS;
    const intervals = [...accumulator.intervals, intervalMs];
    while (intervals.length > windowSize) {
      intervals.shift();
    }
    return {
      accumulator: {
        intervals,
        acceptedDurationMs: intervals.reduce((a, b) => a + b, 0),
        wallClockStartedAt: accumulator.wallClockStartedAt ?? nowMs,
      },
      shouldCompute: intervals.length === windowSize,
      epochTimedOut: false,
    };
  }

  // Clinical: accumulate until 5 min of accepted intervals, or timeout.
  const wallClockStartedAt = accumulator.wallClockStartedAt ?? nowMs;
  if (
    policy.acquisitionTimeoutMs != null &&
    nowMs - wallClockStartedAt >= policy.acquisitionTimeoutMs
  ) {
    return {
      accumulator: createEmptyHrvEpochAccumulator(),
      shouldCompute: false,
      epochTimedOut: true,
    };
  }

  const intervals = [...accumulator.intervals, intervalMs];
  const acceptedDurationMs = accumulator.acceptedDurationMs + intervalMs;
  const target = policy.epochTargetMs ?? CLINICAL_EPOCH_TARGET_MS;
  const ready = acceptedDurationMs >= target;

  if (ready) {
    return {
      accumulator: {
        intervals,
        acceptedDurationMs,
        wallClockStartedAt,
      },
      shouldCompute: true,
      epochTimedOut: false,
    };
  }

  return {
    accumulator: {
      intervals,
      acceptedDurationMs,
      wallClockStartedAt,
    },
    shouldCompute: false,
    epochTimedOut: false,
  };
}

/** After a successful clinical compute, start a fresh epoch (hold last metrics in UI refs). */
export function beginNextClinicalEpoch(): HrvEpochAccumulator {
  return createEmptyHrvEpochAccumulator();
}

export function formatDurationMmSs(durationMs: number): string {
  const totalSec = Math.max(0, Math.floor(durationMs / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Progress label for HRV card while metrics are not yet ready.
 * Client: `12/30`. Clinical: `01:24 / 05:00`.
 */
export function formatHrvProgressLabel(
  mode: HrvAnalysisMode,
  intervalCount: number,
  acceptedDurationMs: number
): string {
  if (mode === "clinical") {
    return `${formatDurationMmSs(acceptedDurationMs)} / ${formatDurationMmSs(
      CLINICAL_EPOCH_TARGET_MS
    )}`;
  }
  return `${intervalCount}/${CLIENT_WINDOW_INTERVALS}`;
}

/**
 * Overall HRV acquisition progress as 0–100 (integer).
 * Client: accepted beats / 30. Clinical: accepted duration / 5 min.
 */
export function hrvProgressPercent(
  mode: HrvAnalysisMode,
  intervalCount: number,
  acceptedDurationMs: number
): number {
  if (mode === "clinical") {
    return Math.min(
      100,
      Math.round((Math.max(0, acceptedDurationMs) / CLINICAL_EPOCH_TARGET_MS) * 100)
    );
  }
  return Math.min(
    100,
    Math.round((Math.max(0, intervalCount) / CLIENT_WINDOW_INTERVALS) * 100)
  );
}
