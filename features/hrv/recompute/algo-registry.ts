/**
 * Versioned HRV algorithm parameters. `hrv-1` is frozen: if the live pipeline
 * changes, add `hrv-2` and keep `hrv-1` for faithful replay of old sessions.
 */

import {
  DEFAULT_HRV_SAMPLING_HZ,
  HF_BAND_HZ,
  LF_BAND_HZ,
  MAX_SUCCESSIVE_DIFF_MS,
  MIN_ACCEPTED_PPI,
  MIN_RESAMPLED_DURATION_SEC,
} from "@/features/hrv/core/hrv-calculator";
import { POLAR_ALGO_VERSION } from "@/features/hrv/contract/contract-version";
import {
  LF_HF_PPI_ERROR_ESTIMATE_MAX_MS,
  PPI_RAW_RETENTION_MAX_MS,
  PPI_RAW_RETENTION_MIN_MS,
} from "@/features/hrv/ppi/ppi-sample-window";
import {
  MAX_PPI_MS,
  MIN_PPI_MS,
  PPI_ERROR_ESTIMATE_SANE_MS,
} from "@/features/hrv/ppi/ppi-limits";

export type AlgoParams = {
  algoVersion: string;
  minPpiMs: number;
  maxPpiMs: number;
  rmssdErrorEstimateMaxMs: number;
  lfHfErrorEstimateMaxMs: number;
  successiveDiffMaxMs: number;
  samplingHz: number;
  lfBandHz: readonly [number, number];
  hfBandHz: readonly [number, number];
  minAcceptedPpi: number;
  minResampledDurationSec: number;
  retentionMinMs: number;
  retentionMaxMs: number;
};

const HRV_1: AlgoParams = {
  algoVersion: "hrv-1",
  minPpiMs: MIN_PPI_MS,
  maxPpiMs: MAX_PPI_MS,
  rmssdErrorEstimateMaxMs: PPI_ERROR_ESTIMATE_SANE_MS,
  lfHfErrorEstimateMaxMs: LF_HF_PPI_ERROR_ESTIMATE_MAX_MS,
  successiveDiffMaxMs: MAX_SUCCESSIVE_DIFF_MS,
  samplingHz: DEFAULT_HRV_SAMPLING_HZ,
  lfBandHz: LF_BAND_HZ,
  hfBandHz: HF_BAND_HZ,
  minAcceptedPpi: MIN_ACCEPTED_PPI,
  minResampledDurationSec: MIN_RESAMPLED_DURATION_SEC,
  retentionMinMs: PPI_RAW_RETENTION_MIN_MS,
  retentionMaxMs: PPI_RAW_RETENTION_MAX_MS,
};

const REGISTRY: Record<string, AlgoParams> = {
  "hrv-1": HRV_1,
};

export function getAlgoParams(algoVersion: string): AlgoParams {
  const params = REGISTRY[algoVersion];
  if (!params) {
    throw new Error(`Unknown algoVersion: ${algoVersion}`);
  }
  return params;
}

/** Current live pipeline version (must stay registered). */
export function currentAlgoVersion(): string {
  return POLAR_ALGO_VERSION;
}

export function listAlgoVersions(): string[] {
  return Object.keys(REGISTRY);
}
