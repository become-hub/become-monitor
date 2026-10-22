import type { HrvAnalysisMode } from "@/features/hrv/core/hrv-analysis-mode";
import type { HrvPreprocessingExport } from "@/features/hrv/ppi/ppi-sample-window";
import type { RrSource } from "@/features/hrv/ppi/rr-interval";
import {
  POLAR_ALGO_VERSION,
  POLAR_PAYLOAD_SCHEMA_VERSION,
} from "./contract-version";
import type { PolarContractDeviceModel, PolarSessionMetaV2 } from "./types";

export const BEATS_COLUMNS: PolarSessionMetaV2["beatsColumns"] = [
  "seq",
  "ppiMs",
  "errorEstimate",
  "kind",
  "blocker",
  "ep",
  "frameId",
];

export const KIND_CODES: PolarSessionMetaV2["kindCodes"] = {
  0: "accepted",
  1: "quality_rejected",
  2: "out_of_physiological_range",
};

export type BuildPolarSessionMetaInput = {
  sid: string;
  ep: number;
  deviceId: string | null;
  deviceModel: PolarContractDeviceModel | null;
  rrSource: RrSource | null;
  contactStatusSupported: boolean | null;
  hrvAnalysisMode: HrvAnalysisMode;
  hrvPreprocessing: HrvPreprocessingExport;
  /** Marketing version, e.g. `v1.2.5` — passed in (no constants import). */
  appVersion: string;
};

export function buildPolarSessionMetaPayload(
  input: BuildPolarSessionMetaInput
): PolarSessionMetaV2 {
  return {
    sid: input.sid,
    ep: input.ep,
    schemaVersion: POLAR_PAYLOAD_SCHEMA_VERSION,
    algoVersion: POLAR_ALGO_VERSION,
    deviceId: input.deviceId,
    deviceModel: input.deviceModel,
    rrSource: input.rrSource,
    contactStatusSupported: input.contactStatusSupported,
    hrvAnalysisMode: input.hrvAnalysisMode,
    beatsColumns: BEATS_COLUMNS,
    kindCodes: KIND_CODES,
    hrvPreprocessing: input.hrvPreprocessing,
    appVersion: input.appVersion,
  };
}
