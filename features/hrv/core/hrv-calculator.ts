/**
 * HRV Calculator — RMSSD + LF/HF periodogram on physiological PPI timeline.
 *
 * Pipeline:
 * raw SDK PPI → quality classification → monotone timeline (X = raw included)
 * → Y artifact correction → irregular tachogram → linear resample 4 Hz
 * → mean subtraction → Hann → zero-pad → FFT → one-sided PSD → LF/HF (ms²)
 *
 * Live 1 Hz publish is separate; this module only consumes beat-to-beat intervals.
 */

import FFT from "fft.js";

export const MAX_SUCCESSIVE_DIFF_MS = 200;

/** LF: [0.04, 0.15) — 0.15 Hz counted only in HF. */
export const LF_BAND_HZ: [number, number] = [0.04, 0.15];
/** HF: [0.15, 0.40] inclusive. */
export const HF_BAND_HZ: [number, number] = [0.15, 0.4];
export const PEAK_BAND_HZ: [number, number] = [0.04, 0.4];
export const DEFAULT_HRV_SAMPLING_HZ = 4;

/** ~30 bpm over 5 min (permissive). 200 ≈ 40 bpm. */
export const MIN_ACCEPTED_PPI = 150;
export const MIN_RESAMPLED_DURATION_SEC = 300;
export const MIN_ACCEPTED_RATIO = 0.75;
export const MAX_ARTIFACT_GAP_SEC = 5;

/**
 * Live warm-up (Task Force 1996: ~2 min minimum for LF).
 * Looser quality gates than the 5 min `valid` flag, for optical wrist PPI.
 */
export const PROVISIONAL_MIN_SEC = 120;
export const PROVISIONAL_MIN_ACCEPTED_RATIO = 0.6;
export const PROVISIONAL_MAX_ARTIFACT_GAP_SEC = 10;

/**
 * LF/HF are always published unless `unavailable`; the status only grades trust.
 * - unavailable: no spectrum (too few beats)
 * - low_quality: below the live gates (accepted ratio / artifact gap)
 * - warming_up: live gates ok, window < 120 s
 * - provisional: live gates ok, ≥ 120 s, not yet the 5 min standard
 * - valid: 5 min standard gates passed
 */
export type LfHfStatus =
  | "unavailable"
  | "low_quality"
  | "warming_up"
  | "provisional"
  | "valid";

export type LfHfIntervalKind =
  | "accepted"
  | "quality_rejected"
  | "out_of_physiological_range";

export type LfHfIntervalInput = {
  ppiMs: number;
  kind?: LfHfIntervalKind;
  /** @deprecated prefer kind; false → quality_rejected */
  accepted?: boolean;
};

export type TachogramSample = {
  timeSec: number;
  rawPpiMs: number;
  correctedPpiMs: number;
  kind: "accepted" | "quality_rejected";
  jumpCorrected: boolean;
};

export type LfHfResult = {
  lf: number;
  hf: number;
  lfHfRatio: number | null;
  peakFrequencyHz: number | null;
  lfPeakFrequencyHz: number | null;
  hfPeakFrequencyHz: number | null;
  includedIntervalDurationSec: number;
  tachogramDomainSec: number;
  resampledDurationSec: number;
  resampledPointCount: number;
  resampleStartSec: number;
  resampleEndSec: number;
  ppiTimesSec: number[];
  rawIncludedPpiMs: number[];
  correctedPpiSeries: number[];
  tachogramSamples: TachogramSample[];
  resampledSeries: number[];
  postDetrendMean: number;
  rawPpiCount: number;
  acceptedPpiCount: number;
  rejectedPpiCount: number;
  correctedPpiCount: number;
  timelineExcludedCount: number;
  acceptedRatio: number;
  maxArtifactGapSec: number;
  valid: boolean;
  status: LfHfStatus;
  /** Wall-clock ms when this result was computed (set by caller if needed). */
  lfHfComputedAt: number | null;
};

export function evaluateLfHfStatus(input: {
  valid: boolean;
  resampledDurationSec: number;
  acceptedRatio: number;
  maxArtifactGapSec: number;
  lf: number;
  hf: number;
}): LfHfStatus {
  if (input.valid) return "valid";
  if (
    input.resampledDurationSec <= 0 ||
    !Number.isFinite(input.lf) ||
    !Number.isFinite(input.hf)
  ) {
    return "unavailable";
  }
  const qualityOk =
    input.acceptedRatio >= PROVISIONAL_MIN_ACCEPTED_RATIO &&
    input.maxArtifactGapSec <= PROVISIONAL_MAX_ARTIFACT_GAP_SEC;
  if (!qualityOk) return "low_quality";
  if (input.resampledDurationSec < PROVISIONAL_MIN_SEC) return "warming_up";
  return "provisional";
}

export function isLfHfPublishable(status: LfHfStatus): boolean {
  return status !== "unavailable";
}

/** User-facing quality: 0 none, 1 low, 2 medium, 3 high. */
export type LfHfQualityLevel = 0 | 1 | 2 | 3;

export function lfHfQualityLevel(status: LfHfStatus): LfHfQualityLevel {
  switch (status) {
    case "valid":
      return 3;
    case "provisional":
      return 2;
    case "low_quality":
    case "warming_up":
      return 1;
    case "unavailable":
      return 0;
  }
}

/** How plausible LF/HF looks for wrist-PPI / short-term HRV. */
export type LfHfRatioSeverity = "ok" | "warn" | "danger";

export type LfHfRatioAssessment = {
  /** Short UI label under the number. */
  label: string;
  severity: LfHfRatioSeverity;
};

/** One plausibility band for the LF/HF ratio (UI guidance, not clinical cutoffs). */
export type LfHfRatioBand = {
  /** Inclusive lower bound; `null` = open below. */
  min: number | null;
  /** Inclusive upper bound; `null` = open above. */
  max: number | null;
  /** Range shown in the thresholds modal, e.g. "0,2 – 5". */
  rangeLabel: string;
  label: string;
  severity: LfHfRatioSeverity;
  /** Short tip for the user. */
  hint: string;
};

/**
 * Plausibility bands for LF/HF (user guidance for optical PPI datasets).
 * Keep in sync with `assessLfHfRatio` edges: <0.2 · ≤5 · ≤10 · ≤20 · ≤50 · >50.
 */
export const LF_HF_RATIO_BANDS: readonly LfHfRatioBand[] = [
  {
    min: null,
    max: 0.2,
    rangeLabel: "< 0,2",
    label: "insolito",
    severity: "warn",
    hint: "Valore molto basso: spesso HF dominante o finestra ancora instabile.",
  },
  {
    min: 0.2,
    max: 5,
    rangeLabel: "0,2 – 5",
    label: "plausibile",
    severity: "ok",
    hint: "Fascia tipica a riposo o con carico moderato su misure short-term.",
  },
  {
    min: 5,
    max: 10,
    rangeLabel: "5 – 10",
    label: "da controllare",
    severity: "warn",
    hint: "Possibile stress / simpatia alta, oppure segnale ottico ancora debole.",
  },
  {
    min: 10,
    max: 20,
    rangeLabel: "10 – 20",
    label: "molto insolito",
    severity: "danger",
    hint: "Raro in condizioni normali: verifica contatto, movimento e qualità LF/HF.",
  },
  {
    min: 20,
    max: 50,
    rangeLabel: "20 – 50",
    label: "sospetto",
    severity: "danger",
    hint: "Spesso artefatto da polso: riposiziona il bracciale e resta fermo.",
  },
  {
    min: 50,
    max: null,
    rangeLabel: "> 50",
    label: "probabile artefatto",
    severity: "danger",
    hint: "Quasi certamente rumore o gap interpolati: non usare questo numero.",
  },
];

/**
 * Plausibility bands for LF/HF (user guidance for optical PPI datasets).
 * 0.2–5 ok · 5–10 check · 10–20 unusual · 20–50 suspect · >50 artifact.
 */
export function assessLfHfRatio(
  ratio: number | null | undefined
): LfHfRatioAssessment | null {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) {
    return null;
  }
  if (ratio < 0.2) {
    return { label: LF_HF_RATIO_BANDS[0].label, severity: LF_HF_RATIO_BANDS[0].severity };
  }
  if (ratio <= 5) {
    return { label: LF_HF_RATIO_BANDS[1].label, severity: LF_HF_RATIO_BANDS[1].severity };
  }
  if (ratio <= 10) {
    return { label: LF_HF_RATIO_BANDS[2].label, severity: LF_HF_RATIO_BANDS[2].severity };
  }
  if (ratio <= 20) {
    return { label: LF_HF_RATIO_BANDS[3].label, severity: LF_HF_RATIO_BANDS[3].severity };
  }
  if (ratio <= 50) {
    return { label: LF_HF_RATIO_BANDS[4].label, severity: LF_HF_RATIO_BANDS[4].severity };
  }
  return { label: LF_HF_RATIO_BANDS[5].label, severity: LF_HF_RATIO_BANDS[5].severity };
}

export type LfHfRequirementKey = "acceptedRatio" | "maxArtifactGapSec" | "duration";

export type LfHfRequirementProgress = {
  key: LfHfRequirementKey;
  current: number;
  target: number;
  /** `min` = current must reach target; `max` = current must stay under it. */
  direction: "min" | "max";
  met: boolean;
  /** 0..1 */
  progress: number;
};

export type LfHfProgress = {
  /** null when already `valid`. */
  nextStatus: "provisional" | "valid" | null;
  /** 0..1; the weakest requirement drives the overall bar. */
  overall: number;
  requirements: LfHfRequirementProgress[];
};

function minRequirement(
  key: LfHfRequirementKey,
  current: number,
  target: number
): LfHfRequirementProgress {
  return {
    key,
    current,
    target,
    direction: "min",
    met: current >= target,
    progress: target > 0 ? Math.min(1, Math.max(0, current / target)) : 1,
  };
}

function maxRequirement(
  key: LfHfRequirementKey,
  current: number,
  target: number
): LfHfRequirementProgress {
  return {
    key,
    current,
    target,
    direction: "max",
    met: current <= target,
    progress: current <= target ? 1 : Math.max(0, target / current),
  };
}

/** Progress toward the next trust level (provisional, then valid). */
export function computeLfHfProgress(input: {
  status: LfHfStatus;
  acceptedRatio: number;
  maxArtifactGapSec: number;
  resampledDurationSec: number;
}): LfHfProgress {
  if (input.status === "valid") {
    return { nextStatus: null, overall: 1, requirements: [] };
  }
  const toValid = input.status === "provisional";
  const requirements = [
    minRequirement(
      "acceptedRatio",
      input.acceptedRatio,
      toValid ? MIN_ACCEPTED_RATIO : PROVISIONAL_MIN_ACCEPTED_RATIO
    ),
    maxRequirement(
      "maxArtifactGapSec",
      input.maxArtifactGapSec,
      toValid ? MAX_ARTIFACT_GAP_SEC : PROVISIONAL_MAX_ARTIFACT_GAP_SEC
    ),
    minRequirement(
      "duration",
      input.resampledDurationSec,
      toValid ? MIN_RESAMPLED_DURATION_SEC : PROVISIONAL_MIN_SEC
    ),
  ];
  return {
    nextStatus: toValid ? "valid" : "provisional",
    overall: Math.min(...requirements.map((r) => r.progress)),
    requirements,
  };
}

export function resolveIntervalKind(
  input: LfHfIntervalInput
): LfHfIntervalKind {
  if (input.kind != null) return input.kind;
  if (input.accepted === false) return "quality_rejected";
  return "accepted";
}

export function calculateRMSSD(ppiWindow: number[]): number {
  if (ppiWindow.length < 2) return 0;
  const diffs = [];
  for (let i = 0; i < ppiWindow.length - 1; i++) {
    const diff = ppiWindow[i + 1] - ppiWindow[i];
    if (Math.abs(diff) < MAX_SUCCESSIVE_DIFF_MS) diffs.push(diff);
  }
  if (diffs.length < 2) return 0;
  const meanSquared =
    diffs.reduce((a, d) => a + d * d, 0) / diffs.length;
  return Math.sqrt(meanSquared);
}

/**
 * Legacy dense jump filter (H10 / short windows). Returns null if &lt; 10 anchors.
 */
export function replaceSuccessiveJumpArtifacts(
  ppiWindow: number[]
): number[] | null {
  const built = buildTachogramFromIntervals(
    ppiWindow.map((ppiMs) => ({ ppiMs, kind: "accepted" as const }))
  );
  if (!built || built.correctedPpiSeries.length < 10) return null;
  return built.correctedForRawIndex.map((v, i) =>
    Number.isFinite(v) ? v : ppiWindow[i]
  );
}

export type TachogramBuild = {
  correctedForRawIndex: number[];
  tachogramSamples: TachogramSample[];
  ppiTimesSec: number[];
  rawIncludedPpiMs: number[];
  correctedPpiSeries: number[];
  correctedPpiCount: number;
  timelineExcludedCount: number;
  includedIntervalDurationSec: number;
  tachogramDomainSec: number;
  maxArtifactGapSec: number;
  beatTimesSec: number[];
};

/**
 * X = cumulative raw included intervals; Y = corrected values.
 * out_of_physiological_range: excluded from timeline and tachogram.
 */
export function buildTachogramFromIntervals(
  intervals: LfHfIntervalInput[]
): TachogramBuild | null {
  if (intervals.length === 0) return null;

  const kinds = intervals.map(resolveIntervalKind);

  // Anchors: accepted + successive-diff OK
  const anchorIndices: number[] = [];
  let lastAnchor: number | null = null;
  for (let i = 0; i < intervals.length; i++) {
    if (kinds[i] !== "accepted") continue;
    const raw = intervals[i].ppiMs;
    if (!Number.isFinite(raw) || raw <= 0) continue;
    if (
      lastAnchor === null ||
      Math.abs(raw - lastAnchor) < MAX_SUCCESSIVE_DIFF_MS
    ) {
      anchorIndices.push(i);
      lastAnchor = raw;
    }
  }
  if (anchorIndices.length < 2) return null;

  const interpolateAt = (i: number): number => {
    let left = -1;
    let right = -1;
    for (const a of anchorIndices) {
      if (a <= i) left = a;
      if (a >= i && right < 0) right = a;
    }
    if (left < 0) return intervals[right].ppiMs;
    if (right < 0) return intervals[left].ppiMs;
    if (left === right) return intervals[left].ppiMs;
    const frac = (i - left) / (right - left);
    return (
      intervals[left].ppiMs * (1 - frac) + intervals[right].ppiMs * frac
    );
  };

  const correctedForRawIndex = new Array<number>(intervals.length).fill(
    Number.NaN
  );
  let correctedPpiCount = 0;

  for (let i = 0; i < intervals.length; i++) {
    if (kinds[i] === "out_of_physiological_range") continue;
    if (kinds[i] === "accepted" && anchorIndices.includes(i)) {
      correctedForRawIndex[i] = intervals[i].ppiMs;
      continue;
    }
    correctedForRawIndex[i] = interpolateAt(i);
    correctedPpiCount += 1;
  }

  // Beat timeline from included raw only
  const beatTimesSec: number[] = [0];
  const includedIndices: number[] = [];
  let includedIntervalDurationSec = 0;
  let timelineExcludedCount = 0;

  for (let i = 0; i < intervals.length; i++) {
    if (kinds[i] === "out_of_physiological_range") {
      timelineExcludedCount += 1;
      continue;
    }
    const dur = Math.max(0, intervals[i].ppiMs) / 1000;
    includedIntervalDurationSec += dur;
    beatTimesSec.push(beatTimesSec[beatTimesSec.length - 1] + dur);
    includedIndices.push(i);
  }

  const tachogramSamples: TachogramSample[] = [];
  const ppiTimesSec: number[] = [];
  const rawIncludedPpiMs: number[] = [];
  const correctedPpiSeries: number[] = [];

  let maxArtifactGapSec = 0;
  let currentArtifactGapSec = 0;

  for (let k = 0; k < includedIndices.length; k++) {
    const rawIndex = includedIndices[k];
    const timeSec = beatTimesSec[k + 1];
    const rawPpiMs = intervals[rawIndex].ppiMs;
    const correctedPpiMs = correctedForRawIndex[rawIndex];
    if (!Number.isFinite(correctedPpiMs)) continue;

    if (ppiTimesSec.length > 0 && !(timeSec > ppiTimesSec[ppiTimesSec.length - 1])) {
      continue;
    }

    const kind =
      kinds[rawIndex] === "accepted" ? "accepted" : "quality_rejected";
    const jumpCorrected =
      kind === "accepted" &&
      Math.abs(correctedPpiMs - rawPpiMs) > 1e-6;
    const isArtifact =
      kind === "quality_rejected" || jumpCorrected;

    const intervalDurationSec = Math.max(0, rawPpiMs) / 1000;
    if (isArtifact) {
      currentArtifactGapSec += intervalDurationSec;
    } else {
      maxArtifactGapSec = Math.max(maxArtifactGapSec, currentArtifactGapSec);
      currentArtifactGapSec = 0;
    }

    tachogramSamples.push({
      timeSec,
      rawPpiMs,
      correctedPpiMs,
      kind,
      jumpCorrected,
    });
    ppiTimesSec.push(timeSec);
    rawIncludedPpiMs.push(rawPpiMs);
    correctedPpiSeries.push(correctedPpiMs);
  }

  maxArtifactGapSec = Math.max(maxArtifactGapSec, currentArtifactGapSec);

  if (ppiTimesSec.length < 2) return null;

  const tachogramDomainSec =
    ppiTimesSec[ppiTimesSec.length - 1] - ppiTimesSec[0];

  return {
    correctedForRawIndex,
    tachogramSamples,
    ppiTimesSec,
    rawIncludedPpiMs,
    correctedPpiSeries,
    correctedPpiCount,
    timelineExcludedCount,
    includedIntervalDurationSec,
    tachogramDomainSec,
    maxArtifactGapSec,
    beatTimesSec,
  };
}

/**
 * Linear resample ONLY within [tSec[0], tSec[last]] — no extrapolation.
 */
export function resampleUniformLinear(
  tSec: number[],
  y: number[],
  sampleRateHz: number = DEFAULT_HRV_SAMPLING_HZ
): {
  series: number[];
  startSec: number;
  endSec: number;
  durationSec: number;
} {
  if (tSec.length < 2 || y.length !== tSec.length || sampleRateHz <= 0) {
    return { series: [], startSec: 0, endSec: 0, durationSec: 0 };
  }
  for (let i = 1; i < tSec.length; i++) {
    if (!(tSec[i] > tSec[i - 1]) || !Number.isFinite(tSec[i])) {
      return { series: [], startSec: 0, endSec: 0, durationSec: 0 };
    }
  }

  const startSec = tSec[0];
  const endSec = tSec[tSec.length - 1];
  const durationSec = endSec - startSec;
  if (durationSec <= 0) {
    return { series: [], startSec, endSec, durationSec: 0 };
  }

  // Grid: start, start+dt, … ≤ end (no extrapolation past last beat).
  const dt = 1 / sampleRateHz;
  const n = Math.max(2, Math.floor(durationSec * sampleRateHz) + 1);
  const series = new Array<number>(n);
  let j = 0;

  for (let i = 0; i < n; i++) {
    const t = Math.min(endSec, startSec + i * dt);
    while (j < tSec.length - 2 && tSec[j + 1] < t) j += 1;
    const t0 = tSec[j];
    const t1 = tSec[j + 1];
    if (t <= t0) series[i] = y[j];
    else if (t >= t1) series[i] = y[j + 1];
    else {
      const frac = (t - t0) / (t1 - t0);
      series[i] = y[j] * (1 - frac) + y[j + 1] * frac;
    }
  }

  return { series, startSec, endSec, durationSec };
}

function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1;
    return w;
  }
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return w;
}

/** Mean-subtract → Hann → zero-pad → one-sided PSD. */
export function computeOneSidedPsd(
  series: number[],
  sampleRateHz: number
): {
  psd: number[];
  df: number;
  freqs: number[];
  postDetrendMean: number;
  detrended: number[];
} {
  const n = series.length;
  if (n < 2) {
    return {
      psd: [],
      df: 0,
      freqs: [],
      postDetrendMean: 0,
      detrended: [],
    };
  }

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const detrended = series.map((v) => v - mean);
  const postDetrendMean =
    detrended.reduce((a, b) => a + b, 0) / detrended.length;

  const w = hannWindow(n);
  let sumW2 = 0;
  const windowed = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    windowed[i] = detrended[i] * w[i];
    sumW2 += w[i] * w[i];
  }

  let fftSize = 1;
  while (fftSize < n) fftSize <<= 1;

  const fftInput = new Array(fftSize).fill(0);
  for (let i = 0; i < n; i++) fftInput[i] = windowed[i];

  const fft = new FFT(fftSize);
  const out = fft.createComplexArray();
  fft.realTransform(out, fftInput);

  const df = sampleRateHz / fftSize;
  const half = Math.floor(fftSize / 2);
  const scale = 1 / (sampleRateHz * sumW2);
  const psd: number[] = [];
  const freqs: number[] = [];

  for (let k = 0; k <= half; k++) {
    const re = out[2 * k] ?? 0;
    const im = out[2 * k + 1] ?? 0;
    let power = (re * re + im * im) * scale;
    if (k > 0 && k < half) power *= 2;
    psd.push(power);
    freqs.push(k * df);
  }

  return { psd, df, freqs, postDetrendMean, detrended };
}

export function evaluateLfHfValidity(input: {
  resampledDurationSec: number;
  acceptedPpiCount: number;
  acceptedRatio: number;
  maxArtifactGapSec: number;
  ppiTimesSec: number[];
  resampledLength: number;
  lf: number;
  hf: number;
}): boolean {
  const timesOk =
    input.ppiTimesSec.length >= 2 &&
    input.ppiTimesSec.every(
      (t, i, arr) => Number.isFinite(t) && (i === 0 || t > arr[i - 1])
    );

  return (
    input.resampledDurationSec >= MIN_RESAMPLED_DURATION_SEC &&
    input.acceptedPpiCount >= MIN_ACCEPTED_PPI &&
    input.acceptedRatio >= MIN_ACCEPTED_RATIO &&
    input.maxArtifactGapSec <= MAX_ARTIFACT_GAP_SEC &&
    timesOk &&
    input.resampledLength >= 2 &&
    Number.isFinite(input.lf) &&
    Number.isFinite(input.hf)
  );
}

function emptyResult(
  partial: Partial<LfHfResult> & {
    rawPpiCount: number;
    acceptedPpiCount: number;
    rejectedPpiCount: number;
  }
): LfHfResult {
  return {
    lf: 0,
    hf: 0,
    lfHfRatio: null,
    peakFrequencyHz: null,
    lfPeakFrequencyHz: null,
    hfPeakFrequencyHz: null,
    includedIntervalDurationSec: partial.includedIntervalDurationSec ?? 0,
    tachogramDomainSec: partial.tachogramDomainSec ?? 0,
    resampledDurationSec: 0,
    resampledPointCount: 0,
    resampleStartSec: 0,
    resampleEndSec: 0,
    ppiTimesSec: partial.ppiTimesSec ?? [],
    rawIncludedPpiMs: partial.rawIncludedPpiMs ?? [],
    correctedPpiSeries: partial.correctedPpiSeries ?? [],
    tachogramSamples: partial.tachogramSamples ?? [],
    resampledSeries: [],
    postDetrendMean: 0,
    rawPpiCount: partial.rawPpiCount,
    acceptedPpiCount: partial.acceptedPpiCount,
    rejectedPpiCount: partial.rejectedPpiCount,
    correctedPpiCount: partial.correctedPpiCount ?? 0,
    timelineExcludedCount: partial.timelineExcludedCount ?? 0,
    acceptedRatio: partial.acceptedRatio ?? 0,
    maxArtifactGapSec: partial.maxArtifactGapSec ?? 0,
    valid: false,
    status: "unavailable",
    lfHfComputedAt: null,
  };
}

/**
 * Full LF/HF from classified intervals.
 * X from raw included; Y from corrected — never rebuild X from Y.
 */
export function computeLfHfFromIntervals(
  intervals: LfHfIntervalInput[],
  sampleRateHz: number = DEFAULT_HRV_SAMPLING_HZ
): LfHfResult {
  const rawPpiCount = intervals.length;
  const kinds = intervals.map(resolveIntervalKind);
  const acceptedPpiCount = kinds.filter((k) => k === "accepted").length;
  const rejectedPpiCount = kinds.filter(
    (k) => k === "quality_rejected" || k === "out_of_physiological_range"
  ).length;
  const acceptedRatio = rawPpiCount > 0 ? acceptedPpiCount / rawPpiCount : 0;

  if (rawPpiCount < 2) {
    return emptyResult({
      rawPpiCount,
      acceptedPpiCount,
      rejectedPpiCount,
      acceptedRatio,
    });
  }

  const built = buildTachogramFromIntervals(intervals);
  if (!built) {
    return emptyResult({
      rawPpiCount,
      acceptedPpiCount,
      rejectedPpiCount,
      acceptedRatio,
      timelineExcludedCount: kinds.filter(
        (k) => k === "out_of_physiological_range"
      ).length,
    });
  }

  const {
    tachogramSamples,
    ppiTimesSec,
    rawIncludedPpiMs,
    correctedPpiSeries,
    correctedPpiCount,
    timelineExcludedCount,
    includedIntervalDurationSec,
    tachogramDomainSec,
    maxArtifactGapSec,
  } = built;

  const resampled = resampleUniformLinear(
    ppiTimesSec,
    correctedPpiSeries,
    sampleRateHz
  );

  if (resampled.series.length < 2) {
    return emptyResult({
      rawPpiCount,
      acceptedPpiCount,
      rejectedPpiCount,
      acceptedRatio,
      correctedPpiCount,
      timelineExcludedCount,
      includedIntervalDurationSec,
      tachogramDomainSec,
      maxArtifactGapSec,
      ppiTimesSec,
      rawIncludedPpiMs,
      correctedPpiSeries,
      tachogramSamples,
    });
  }

  const { psd, df, freqs, postDetrendMean } = computeOneSidedPsd(
    resampled.series,
    sampleRateHz
  );

  let lf = 0;
  let hf = 0;
  let peakFrequencyHz: number | null = null;
  let peakPower = -1;
  let lfPeakFrequencyHz: number | null = null;
  let lfPeakPower = -1;
  let hfPeakFrequencyHz: number | null = null;
  let hfPeakPower = -1;

  for (let k = 0; k < psd.length; k++) {
    const freq = freqs[k];
    const power = psd[k];
    if (freq >= LF_BAND_HZ[0] && freq < LF_BAND_HZ[1]) {
      lf += power * df;
      if (power > lfPeakPower) {
        lfPeakPower = power;
        lfPeakFrequencyHz = freq;
      }
    }
    if (freq >= HF_BAND_HZ[0] && freq <= HF_BAND_HZ[1]) {
      hf += power * df;
      if (power > hfPeakPower) {
        hfPeakPower = power;
        hfPeakFrequencyHz = freq;
      }
    }
    if (
      freq >= PEAK_BAND_HZ[0] &&
      freq <= PEAK_BAND_HZ[1] &&
      power > peakPower
    ) {
      peakPower = power;
      peakFrequencyHz = freq;
    }
  }

  const lfHfRatio = hf > 0 ? lf / hf : null;
  const valid = evaluateLfHfValidity({
    resampledDurationSec: resampled.durationSec,
    acceptedPpiCount,
    acceptedRatio,
    maxArtifactGapSec,
    ppiTimesSec,
    resampledLength: resampled.series.length,
    lf,
    hf,
  });
  const status = evaluateLfHfStatus({
    valid,
    resampledDurationSec: resampled.durationSec,
    acceptedRatio,
    maxArtifactGapSec,
    lf,
    hf,
  });

  return {
    lf,
    hf,
    lfHfRatio,
    peakFrequencyHz,
    lfPeakFrequencyHz,
    hfPeakFrequencyHz,
    includedIntervalDurationSec,
    tachogramDomainSec,
    resampledDurationSec: resampled.durationSec,
    resampledPointCount: resampled.series.length,
    resampleStartSec: resampled.startSec,
    resampleEndSec: resampled.endSec,
    ppiTimesSec,
    rawIncludedPpiMs,
    correctedPpiSeries,
    tachogramSamples,
    resampledSeries: resampled.series,
    postDetrendMean,
    rawPpiCount,
    acceptedPpiCount,
    rejectedPpiCount,
    correctedPpiCount,
    timelineExcludedCount,
    acceptedRatio,
    maxArtifactGapSec,
    valid,
    status,
    lfHfComputedAt: null,
  };
}

/**
 * Recompute LF/HF from exported tachogram times + corrected Y
 * (external verification path — same resample/PSD).
 */
export function computeLfHfFromTachogram(
  ppiTimesSec: number[],
  correctedPpiSeries: number[],
  sampleRateHz: number = DEFAULT_HRV_SAMPLING_HZ
): { lf: number; hf: number } {
  const resampled = resampleUniformLinear(
    ppiTimesSec,
    correctedPpiSeries,
    sampleRateHz
  );
  if (resampled.series.length < 2) return { lf: 0, hf: 0 };
  const { psd, df, freqs } = computeOneSidedPsd(
    resampled.series,
    sampleRateHz
  );
  let lf = 0;
  let hf = 0;
  for (let k = 0; k < psd.length; k++) {
    const freq = freqs[k];
    if (freq >= LF_BAND_HZ[0] && freq < LF_BAND_HZ[1]) lf += psd[k] * df;
    if (freq >= HF_BAND_HZ[0] && freq <= HF_BAND_HZ[1]) hf += psd[k] * df;
  }
  return { lf, hf };
}

/** All intervals accepted. Returns powers even if lfHfValid is false (short windows). */
export function computeLfHf(
  ppiWindow: number[],
  sampleRateHz: number = DEFAULT_HRV_SAMPLING_HZ
): { lf: number; hf: number } {
  const result = computeLfHfFromIntervals(
    ppiWindow.map((ppiMs) => ({ ppiMs, kind: "accepted" as const })),
    sampleRateHz
  );
  if (
    !Number.isFinite(result.lf) ||
    !Number.isFinite(result.hf) ||
    result.resampledPointCount < 2
  ) {
    return { lf: 0, hf: 0 };
  }
  return { lf: result.lf, hf: result.hf };
}

export function computeLfHfDetailed(
  ppiWindow: number[],
  sampleRateHz: number = DEFAULT_HRV_SAMPLING_HZ
): LfHfResult {
  return computeLfHfFromIntervals(
    ppiWindow.map((ppiMs) => ({ ppiMs, kind: "accepted" as const })),
    sampleRateHz
  );
}

/** @deprecated use includedIntervalDurationSec */
export function physiologicalDurationSec(ppiMs: number[]): number {
  return ppiMs.reduce((a, b) => a + Math.max(0, b), 0) / 1000;
}

/** @deprecated */
export function beatClosureTimesSec(ppiMs: number[]): number[] {
  const t: number[] = [];
  let acc = 0;
  for (const p of ppiMs) {
    acc += Math.max(0, p) / 1000;
    t.push(acc);
  }
  return t;
}
