import type { LfHfStatus } from "@/features/hrv/core/hrv-calculator";
import type { HrvAnalysisMode } from "@/features/hrv/core/hrv-analysis-mode";
import type { HrvPreprocessingExport } from "@/features/hrv/ppi/ppi-sample-window";
import type { PolarBeatTuple } from "@/features/hrv/ppi/beat-outbox";
import type { RrSource } from "@/features/hrv/ppi/rr-interval";
import type {
  PolarAlgoVersion,
  PolarPayloadSchemaVersion,
} from "./contract-version";

export type { PolarBeatTuple } from "@/features/hrv/ppi/beat-outbox";

/** Catalog product id; kept as string union locally to avoid runtime device imports. */
export type PolarContractDeviceModel =
  | "polar_360"
  | "polar_loop"
  | "polar_h10";

/**
 * Evento `heartRate` a 1 Hz (360 / Loop).
 * Campo assente = valore normale/null:
 * - signalStale assente = false
 * - blocker assente = false
 * - contactStatus assente = ok o sconosciuto
 * - hrv / lfPower / hfPower assenti = null
 * - lfHfStatus assente = "unavailable"
 */
export type PolarHeartRateTickV2 = {
  sid: string;
  /** bpm; 0 solo con signalStale. */
  hr: number;
  hrv?: number;
  lfPower?: number;
  hfPower?: number;
  lfHfStatus?: LfHfStatus;
  /** Beat nuovi dall'ultimo ack (0..120). Mai la finestra intera. */
  beats: PolarBeatTuple[];
  /** seq del primo beat nella finestra LF/HF corrente. */
  windowFromSeq?: number;
  /** Ogni ~30 tick: CRC32 (hex) di (ppiMs, kind) della finestra. */
  windowCrc?: string;
  windowBeatCount?: number;
  signalStale?: true;
  blocker?: true;
  contactStatus?: false;
  /** Solo Loop Gen 2, quando presente. */
  skinTemperatureC?: number;
};

export type PolarSessionMetaV2 = {
  sid: string;
  ep: number;
  schemaVersion: PolarPayloadSchemaVersion;
  algoVersion: PolarAlgoVersion;
  deviceId: string | null;
  deviceModel: PolarContractDeviceModel | null;
  rrSource: RrSource | null;
  contactStatusSupported: boolean | null;
  hrvAnalysisMode: HrvAnalysisMode;
  beatsColumns: [
    "seq",
    "ppiMs",
    "errorEstimate",
    "kind",
    "blocker",
    "ep",
    "frameId",
  ];
  kindCodes: {
    0: "accepted";
    1: "quality_rejected";
    2: "out_of_physiological_range";
  };
  hrvPreprocessing: HrvPreprocessingExport;
  appVersion: string;
};

export type PolarSessionEndV2 = {
  sid: string;
  lastSeq: number;
  beatCount: number;
  epochs: number;
  ticks: number;
};

/** H10 (`ecg_rr`): few native RR values per tick, no PPI beat outbox. */
export type PolarH10HeartRateTickV2 = {
  sid: string;
  hr: number;
  hrv?: number;
  lfPower?: number;
  hfPower?: number;
  lfHfStatus?: LfHfStatus;
  rrSource: "ecg_rr";
  rrsMs?: number[];
  signalStale?: true;
};
