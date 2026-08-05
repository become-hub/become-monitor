/**
 * Confronto segnali Polar 360 / Loop Gen 2 / H10 / Muse 2 (valori Sì/No).
 */

import {
  AvailableDeviceId,
  isDeviceAvailable,
} from "@/constants/device-availability";

export type SignalUsedInApp = "yes" | "no" | "derived" | "na";

export type SignalDeviceColumn =
  | "polar360"
  | "polarLoop"
  | "polarH10"
  | "muse2";

export interface PolarSignalRow {
  id: string;
  metricKey: string;
  polar360: string;
  polarLoop: string;
  polarH10: string;
  muse2: string;
  scientificNoteKey: string;
  usedInApp: SignalUsedInApp;
}

export interface SignalComparisonDevice {
  column: SignalDeviceColumn;
  availabilityId: AvailableDeviceId;
  titleKey: string;
  /** Short header for the comparison table. */
  shortLabel: string;
}

export const SIGNAL_COMPARISON_DEVICES: readonly SignalComparisonDevice[] = [
  {
    column: "polar360",
    availabilityId: "polar_360",
    titleKey: "docs.signalPolar360",
    shortLabel: "P.360",
  },
  {
    column: "polarLoop",
    availabilityId: "polar_loop",
    titleKey: "docs.signalPolarLoop",
    shortLabel: "P.Loop2",
  },
  {
    column: "polarH10",
    availabilityId: "polar_h10",
    titleKey: "docs.signalPolarH10",
    shortLabel: "P.H10",
  },
  {
    column: "muse2",
    availabilityId: "muse_2",
    titleKey: "docs.signalMuse2",
    shortLabel: "Muse2",
  },
] as const;

export const POLAR_SIGNAL_ROWS: PolarSignalRow[] = [
  {
    id: "sensing_principle",
    metricKey: "docs.signalSensingPrinciple",
    polar360: "Sì",
    polarLoop: "Sì",
    polarH10: "Sì",
    muse2: "Sì",
    scientificNoteKey: "docs.signalNoteSensing",
    usedInApp: "yes",
  },
  {
    id: "ecg",
    metricKey: "docs.signalEcg",
    polar360: "No",
    polarLoop: "No",
    polarH10: "Sì",
    muse2: "No",
    scientificNoteKey: "docs.signalNoteEcg",
    usedInApp: "na",
  },
  {
    id: "eeg",
    metricKey: "docs.signalEeg",
    polar360: "No",
    polarLoop: "No",
    polarH10: "No",
    muse2: "Sì",
    scientificNoteKey: "docs.signalNoteEeg",
    usedInApp: "yes",
  },
  {
    id: "hr",
    metricKey: "docs.signalHr",
    polar360: "Sì",
    polarLoop: "Sì",
    polarH10: "Sì",
    muse2: "Sì",
    scientificNoteKey: "docs.signalNoteHr",
    usedInApp: "yes",
  },
  {
    id: "ppi",
    metricKey: "docs.signalPpi",
    polar360: "Sì",
    polarLoop: "Sì",
    polarH10: "No",
    muse2: "No",
    scientificNoteKey: "docs.signalNotePpi",
    usedInApp: "yes",
  },
  {
    id: "rr",
    metricKey: "docs.signalRr",
    polar360: "Sì",
    polarLoop: "Sì",
    polarH10: "Sì",
    muse2: "No",
    scientificNoteKey: "docs.signalNoteRr",
    usedInApp: "derived",
  },
  {
    id: "hrv_rmssd",
    metricKey: "docs.signalHrvRmssd",
    polar360: "Sì",
    polarLoop: "Sì",
    polarH10: "Sì",
    muse2: "No",
    scientificNoteKey: "docs.signalNoteHrv",
    usedInApp: "derived",
  },
  {
    id: "lf_hf",
    metricKey: "docs.signalLfHf",
    polar360: "Sì",
    polarLoop: "Sì",
    polarH10: "Sì",
    muse2: "No",
    scientificNoteKey: "docs.signalNoteLfHf",
    usedInApp: "derived",
  },
  {
    id: "eeg_bands",
    metricKey: "docs.signalEegBands",
    polar360: "No",
    polarLoop: "No",
    polarH10: "No",
    muse2: "Sì",
    scientificNoteKey: "docs.signalNoteEegBands",
    usedInApp: "yes",
  },
  {
    id: "raw_ppg",
    metricKey: "docs.signalRawPpg",
    polar360: "Sì",
    polarLoop: "Sì",
    polarH10: "No",
    muse2: "Sì",
    scientificNoteKey: "docs.signalNoteRawPpg",
    usedInApp: "yes",
  },
  {
    id: "raw_ecg",
    metricKey: "docs.signalRawEcg",
    polar360: "No",
    polarLoop: "No",
    polarH10: "Sì",
    muse2: "No",
    scientificNoteKey: "docs.signalNoteRawEcg",
    usedInApp: "yes",
  },
  {
    id: "acc",
    metricKey: "docs.signalAcc",
    polar360: "Sì",
    polarLoop: "Sì",
    polarH10: "Sì",
    muse2: "Sì",
    scientificNoteKey: "docs.signalNoteAcc",
    usedInApp: "no",
  },
  {
    id: "skin_temp",
    metricKey: "docs.signalSkinTemp",
    polar360: "No",
    polarLoop: "Sì",
    polarH10: "No",
    muse2: "No",
    scientificNoteKey: "docs.signalNoteSkinTemp",
    usedInApp: "yes",
  },
  {
    id: "ftu",
    metricKey: "docs.signalFtu",
    polar360: "Sì",
    polarLoop: "Sì",
    polarH10: "No",
    muse2: "No",
    scientificNoteKey: "docs.signalNoteFtu",
    usedInApp: "yes",
  },
];

export function getSignalValue(
  row: PolarSignalRow,
  column: SignalDeviceColumn
): string {
  return row[column];
}

export function getAvailableSignalDevices(): SignalComparisonDevice[] {
  return SIGNAL_COMPARISON_DEVICES.filter((device) =>
    isDeviceAvailable(device.availabilityId)
  );
}
