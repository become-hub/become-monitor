/**
 * Rolling PPI sample window for LF/HF (Polar 360 / Loop).
 * SDK samples only — never from Live 1 Hz UI state.
 */

import type { HrvAnalysisMode } from "@/features/hrv/core/hrv-analysis-mode";
import {
  computeLfHfFromIntervals,
  DEFAULT_HRV_SAMPLING_HZ,
  HF_BAND_HZ,
  LF_BAND_HZ,
  MAX_SUCCESSIVE_DIFF_MS,
  MIN_ACCEPTED_PPI,
  MIN_RESAMPLED_DURATION_SEC,
  type LfHfIntervalInput,
  type LfHfIntervalKind,
  type LfHfResult,
} from "@/features/hrv/core/hrv-calculator";
import { isUsablePpiMs } from "@/features/hrv/ppi/ppi-limits";

/**
 * Max PPI errorEstimate accepted into the LF/HF spectrum. Looser than the
 * RMSSD gate (10 ms): on Polar 360 vs simultaneous H10 ECG, 10 ms rejected
 * ~72% of beats and the interpolation cut LF/HF by ~90%; 20 ms matched ECG
 * within ~18% LF / ~1% HF, while > 20 ms beats inflated LF.
 */
export const LF_HF_PPI_ERROR_ESTIMATE_MAX_MS = 20;

/**
 * Typical absolute deviation of wrist-PPI LF/HF vs simultaneous H10 ECG
 * (same compute, ~5 min windows, one subject, rest). Sign varies by session;
 * not a fixed bias. See docs/lf-hf-validation-log.md.
 */
export const LF_HF_VS_ECG_TYPICAL_ERROR_PCT = 35;

/** Target PSD domain (seconds). */
export const PPI_LFHF_TARGET_SEC = MIN_RESAMPLED_DURATION_SEC;

/** Minimum raw retention margin (ms) — not a validity guarantee. */
export const PPI_RAW_RETENTION_MIN_MS = 310_000;

/** Hard cap to avoid unbounded growth with poor data (ms). */
export const PPI_RAW_RETENTION_MAX_MS = 360_000;

/** @deprecated use PPI_RAW_RETENTION_MIN_MS */
export const PPI_LFHF_WINDOW_MS = PPI_RAW_RETENTION_MIN_MS;

export type PpiRejectReason =
  | "out_of_physiological_range"
  | "quality_rejected"
  | null;

export type PpiSampleRecord = {
  ppiMs: number;
  errorEstimate: number | null;
  blocker: boolean | null;
  /** Wall-clock arrival / reconstructed closure (for retention). */
  timestamp: number;
  rejectReason: PpiRejectReason;
  kind: LfHfIntervalKind;
  accepted: boolean;
  includedInTimeline: boolean;
  includedInTachogram: boolean;
  correctedPpiMs: number | null;
  /** Session outbox seq when published via Ably delta (optional). */
  seq?: number;
};

export type PpiSampleWindow = {
  samples: PpiSampleRecord[];
  lastTimestampMs: number | null;
};

export type HrvPreprocessingExport = {
  artifactFilter: {
    successiveDiffMaxMs: number;
    method: "interpolate_in_place";
    minAcceptedIntervals: number;
  };
  errorEstimateMaxMs: number;
  interpolation: {
    method: "linear_on_time";
    formula: "n = floor(durationSec * samplingHz) + 1";
    domain: "ppiTimesSec[0]..ppiTimesSec[last]";
    noExtrapolation: true;
  };
  detrend: "mean_subtraction";
  window: "hann";
  spectrum: "one_sided";
  samplingHz: number;
  livePublishHz: 1;
  method: "periodogram";
  timelineSource: "cumulative_raw_included_ppi_ms";
  welchSegment: null;
  welchOverlap: null;
  lfBandHz: [number, number];
  hfBandHz: [number, number];
  lfBandNote: "f >= 0.04 && f < 0.15";
  hfBandNote: "f >= 0.15 && f <= 0.40";
  psd: string;
  unit: "ms2";
  zeroPad: "next_pow2_after_hann";
  minAcceptedPpi: number;
  minAcceptedPpiNote: "150 intervals / 300 s ≈ 30 bpm (permissive); 200 ≈ 40 bpm";
};

export const HRV_PREPROCESSING_EXPORT: HrvPreprocessingExport = {
  artifactFilter: {
    successiveDiffMaxMs: MAX_SUCCESSIVE_DIFF_MS,
    method: "interpolate_in_place",
    minAcceptedIntervals: MIN_ACCEPTED_PPI,
  },
  errorEstimateMaxMs: LF_HF_PPI_ERROR_ESTIMATE_MAX_MS,
  interpolation: {
    method: "linear_on_time",
    formula: "n = floor(durationSec * samplingHz) + 1",
    domain: "ppiTimesSec[0]..ppiTimesSec[last]",
    noExtrapolation: true,
  },
  detrend: "mean_subtraction",
  window: "hann",
  spectrum: "one_sided",
  samplingHz: DEFAULT_HRV_SAMPLING_HZ,
  livePublishHz: 1,
  method: "periodogram",
  timelineSource: "cumulative_raw_included_ppi_ms",
  welchSegment: null,
  welchOverlap: null,
  lfBandHz: [...LF_BAND_HZ] as [number, number],
  hfBandHz: [...HF_BAND_HZ] as [number, number],
  lfBandNote: "f >= 0.04 && f < 0.15",
  hfBandNote: "f >= 0.15 && f <= 0.40",
  psd: "|X[k]|^2 / (fs * sum(w^2)); one-sided double k=1..N/2-1; integrate psd * df",
  unit: "ms2",
  zeroPad: "next_pow2_after_hann",
  minAcceptedPpi: MIN_ACCEPTED_PPI,
  minAcceptedPpiNote:
    "150 intervals / 300 s ≈ 30 bpm (permissive); 200 ≈ 40 bpm",
};

export function createEmptyPpiSampleWindow(): PpiSampleWindow {
  return { samples: [], lastTimestampMs: null };
}

export function classifyPpiRejectReason(
  mode: HrvAnalysisMode,
  sample: {
    ppiMs: number;
    errorEstimate?: number | null;
    blocker?: boolean | null;
  }
): PpiRejectReason {
  if (!isUsablePpiMs(sample.ppiMs)) {
    return "out_of_physiological_range";
  }
  const errorEstimate = sample.errorEstimate ?? null;
  if (
    errorEstimate != null &&
    errorEstimate > LF_HF_PPI_ERROR_ESTIMATE_MAX_MS
  ) {
    return "quality_rejected";
  }
  if (mode === "clinical" && sample.blocker === true) {
    return "quality_rejected";
  }
  return null;
}

export function rejectReasonToKind(
  reason: PpiRejectReason
): LfHfIntervalKind {
  if (reason === "out_of_physiological_range") {
    return "out_of_physiological_range";
  }
  if (reason === "quality_rejected") return "quality_rejected";
  return "accepted";
}

/**
 * Append one SDK PPI. Timeline advances only for included samples.
 * out_of_physiological_range: kept for diagnostics, no clock advance.
 */
export function appendPpiSample(
  window: PpiSampleWindow,
  input: {
    ppiMs: number;
    errorEstimate?: number | null;
    blocker?: boolean | null;
    frameNowMs: number;
    mode: HrvAnalysisMode;
    /** Session outbox seq for Ably windowFromSeq checkpoints. */
    seq?: number;
    /**
     * Pre-decided reject reason (offline replay of a stored `kind`).
     * `undefined` = classify live from mode + sample; `null` = accepted.
     */
    rejectReasonOverride?: PpiRejectReason;
  }
): PpiSampleWindow {
  const rejectReason =
    input.rejectReasonOverride !== undefined
      ? input.rejectReasonOverride
      : classifyPpiRejectReason(input.mode, input);
  const kind = rejectReasonToKind(rejectReason);
  const included =
    kind === "accepted" || kind === "quality_rejected";
  const duration = included
    ? Number.isFinite(input.ppiMs)
      ? Math.max(0, input.ppiMs)
      : 0
    : 0;

  let timestamp: number;
  if (window.lastTimestampMs == null) {
    timestamp = input.frameNowMs;
  } else if (included) {
    timestamp = window.lastTimestampMs + duration;
  } else {
    // Excluded: keep last clock for retention wall; don't create duplicate X.
    timestamp = window.lastTimestampMs;
  }

  const record: PpiSampleRecord = {
    ppiMs: input.ppiMs,
    errorEstimate:
      input.errorEstimate != null && Number.isFinite(input.errorEstimate)
        ? input.errorEstimate
        : null,
    blocker: typeof input.blocker === "boolean" ? input.blocker : null,
    timestamp,
    rejectReason,
    kind,
    accepted: kind === "accepted",
    includedInTimeline: included,
    includedInTachogram: included,
    correctedPpiMs: null,
    ...(input.seq != null ? { seq: input.seq } : {}),
  };

  const samples = [...window.samples, record];
  return slidePpiWindow({
    samples,
    lastTimestampMs: included ? timestamp : window.lastTimestampMs ?? timestamp,
  });
}

/**
 * Retention: keep at least MIN ms; keep more (up to MAX) while
 * analyzable resampled domain would still be &lt; 300 s.
 */
export function slidePpiWindow(window: PpiSampleWindow): PpiSampleWindow {
  if (window.samples.length === 0 || window.lastTimestampMs == null) {
    return window;
  }

  const last = window.lastTimestampMs;
  const minCutoff = last - PPI_RAW_RETENTION_MIN_MS;
  const maxCutoff = last - PPI_RAW_RETENTION_MAX_MS;

  // Always drop older than MAX
  let samples = window.samples.filter((s) => s.timestamp >= maxCutoff);

  // If after MIN cutoff we still have resampledDuration < 300, keep down to MAX
  const atMin = samples.filter((s) => s.timestamp >= minCutoff);
  const probe = computeLfHfForPpiWindow({
    samples: atMin,
    lastTimestampMs: last,
  });

  if (
    probe.resampledDurationSec >= MIN_RESAMPLED_DURATION_SEC ||
    atMin.length === samples.length
  ) {
    samples = atMin;
  }
  // else keep samples down to maxCutoff (already applied)

  return { samples, lastTimestampMs: last };
}

export function acceptedPpiSeries(window: PpiSampleWindow): number[] {
  return window.samples.filter((s) => s.accepted).map((s) => s.ppiMs);
}

export function toLfHfIntervalInputs(
  window: PpiSampleWindow
): LfHfIntervalInput[] {
  return window.samples.map((s) => ({
    ppiMs: s.ppiMs,
    kind: s.kind,
  }));
}

/**
 * Wrist-motion gate (status only, LF/HF numbers are never altered).
 * Polar 360 vs H10 field tests: during typing / gesturing the SDK `blocker`
 * flag stays on for nearly every beat while `errorEstimate` stays low, and
 * LF/HF drifts 45–77% from ECG. At rest the rolling blocker fraction over
 * 120 s stayed >= 0.95 for only 0–1% of the time. See
 * docs/lf-hf-validation-log.md.
 */
export const PPI_MOTION_GATE_SPAN_MS = 120_000;
export const PPI_MOTION_GATE_BLOCKER_RATIO = 0.95;
export const PPI_MOTION_GATE_MIN_SAMPLES = 20;

export function isPpiWindowMotionBlocked(window: PpiSampleWindow): boolean {
  const last = window.lastTimestampMs;
  if (last == null) return false;
  const cutoff = last - PPI_MOTION_GATE_SPAN_MS;
  let total = 0;
  let blocked = 0;
  for (let i = window.samples.length - 1; i >= 0; i -= 1) {
    const s = window.samples[i];
    if (s.timestamp <= cutoff) break;
    total += 1;
    if (s.blocker === true) blocked += 1;
  }
  return (
    total >= PPI_MOTION_GATE_MIN_SAMPLES &&
    blocked / total >= PPI_MOTION_GATE_BLOCKER_RATIO
  );
}

export function computeLfHfForPpiWindow(
  window: PpiSampleWindow
): LfHfResult {
  const result = computeLfHfFromIntervals(toLfHfIntervalInputs(window));
  if (result.status !== "unavailable" && isPpiWindowMotionBlocked(window)) {
    return { ...result, valid: false, status: "low_quality" };
  }
  return result;
}

export function isLfHfWindowReady(window: PpiSampleWindow): boolean {
  const result = computeLfHfForPpiWindow(window);
  return result.valid;
}

/** @deprecated use result.includedIntervalDurationSec */
export function physiologicalDurationFromWindow(
  window: PpiSampleWindow
): number {
  return (
    window.samples
      .filter((s) => s.includedInTimeline)
      .reduce((a, s) => a + Math.max(0, s.ppiMs), 0) / 1000
  );
}

export function ppiWindowSpanSeconds(window: PpiSampleWindow): number {
  return physiologicalDurationFromWindow(window);
}

export function ppiSamplesForExport(window: PpiSampleWindow): {
  ppiMs: number;
  errorEstimate: number | null;
  timestamp: number;
  rejectReason: PpiRejectReason;
  accepted: boolean;
  kind: LfHfIntervalKind;
  includedInTimeline: boolean;
  includedInTachogram: boolean;
  correctedPpiMs: number | null;
}[] {
  const result = computeLfHfForPpiWindow(window);
  // Map tachogram corrected Y onto included samples in order
  let includedIdx = 0;
  const correctedByIncluded: number[] = result.correctedPpiSeries;

  return window.samples.map((s) => {
    let correctedPpiMs: number | null = null;
    if (s.includedInTimeline && includedIdx < correctedByIncluded.length) {
      const c = correctedByIncluded[includedIdx];
      if (Math.abs(c - s.ppiMs) > 1e-6) correctedPpiMs = c;
      includedIdx += 1;
    }
    return {
      ppiMs: s.ppiMs,
      errorEstimate: s.errorEstimate,
      timestamp: s.timestamp,
      rejectReason: s.rejectReason,
      accepted: s.accepted,
      kind: s.kind,
      includedInTimeline: s.includedInTimeline,
      includedInTachogram: s.includedInTachogram,
      correctedPpiMs,
    };
  });
}
