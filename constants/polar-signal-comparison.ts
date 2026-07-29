/**
 * Confronto scientifico segnali Polar 360 vs Loop Gen 2
 * (profilo SDK condiviso Polar360.md — non ECG).
 */

export type SignalUsedInApp = 'yes' | 'no' | 'derived' | 'na';

export interface PolarSignalRow {
  id: string;
  metricKey: string;
  polar360: string;
  polarLoop: string;
  scientificNoteKey: string;
  usedInApp: SignalUsedInApp;
}

export type PolarSignalThemeId =
  | 'sensing'
  | 'cardiacIntervals'
  | 'rawSignals'
  | 'appUsage';

export interface PolarSignalTheme {
  id: PolarSignalThemeId;
  titleKey: string;
  descriptionKey: string;
  rowIds: string[];
}

export const POLAR_SIGNAL_ROWS: PolarSignalRow[] = [
  {
    id: 'sensing_principle',
    metricKey: 'docs.signalSensingPrinciple',
    polar360: 'PPG ottico (LED verde)',
    polarLoop: 'PPG ottico (stesso profilo SDK)',
    scientificNoteKey: 'docs.signalNoteSensing',
    usedInApp: 'yes',
  },
  {
    id: 'ecg',
    metricKey: 'docs.signalEcg',
    polar360: 'No',
    polarLoop: 'No',
    scientificNoteKey: 'docs.signalNoteEcg',
    usedInApp: 'na',
  },
  {
    id: 'hr',
    metricKey: 'docs.signalHr',
    polar360: 'Sì (online)',
    polarLoop: 'Sì',
    scientificNoteKey: 'docs.signalNoteHr',
    usedInApp: 'yes',
  },
  {
    id: 'ppi',
    metricKey: 'docs.signalPpi',
    polar360: 'Sì (da PPG)',
    polarLoop: 'Sì (da PPG)',
    scientificNoteKey: 'docs.signalNotePpi',
    usedInApp: 'yes',
  },
  {
    id: 'rr',
    metricKey: 'docs.signalRr',
    polar360: 'Da PPI o 60000/HR',
    polarLoop: 'Da PPI o 60000/HR',
    scientificNoteKey: 'docs.signalNoteRr',
    usedInApp: 'derived',
  },
  {
    id: 'hrv_rmssd',
    metricKey: 'docs.signalHrvRmssd',
    polar360: 'Derivata da PPI/HR',
    polarLoop: 'Derivata da PPI/HR',
    scientificNoteKey: 'docs.signalNoteHrv',
    usedInApp: 'derived',
  },
  {
    id: 'lf_hf',
    metricKey: 'docs.signalLfHf',
    polar360: 'Derivata da finestra RR',
    polarLoop: 'Derivata da finestra RR',
    scientificNoteKey: 'docs.signalNoteLfHf',
    usedInApp: 'derived',
  },
  {
    id: 'raw_ppg',
    metricKey: 'docs.signalRawPpg',
    polar360: 'Sì (SDK; ~22 Hz, 24 bit)',
    polarLoop: 'Stesso profilo SDK',
    scientificNoteKey: 'docs.signalNoteRawPpg',
    usedInApp: 'no',
  },
  {
    id: 'acc',
    metricKey: 'docs.signalAcc',
    polar360: 'Sì (~50 Hz, ±8 g)',
    polarLoop: 'Sì',
    scientificNoteKey: 'docs.signalNoteAcc',
    usedInApp: 'no',
  },
  {
    id: 'skin_temp',
    metricKey: 'docs.signalSkinTemp',
    polar360: 'Sì (1–4 Hz)',
    polarLoop: 'Sì',
    scientificNoteKey: 'docs.signalNoteSkinTemp',
    usedInApp: 'no',
  },
  {
    id: 'ftu',
    metricKey: 'docs.signalFtu',
    polar360: 'Obbligatorio',
    polarLoop: 'Obbligatorio',
    scientificNoteKey: 'docs.signalNoteFtu',
    usedInApp: 'yes',
  },
];

export const POLAR_SIGNAL_THEMES: PolarSignalTheme[] = [
  {
    id: 'sensing',
    titleKey: 'docs.signalThemeSensing',
    descriptionKey: 'docs.signalThemeSensingDesc',
    rowIds: ['sensing_principle', 'ecg', 'ftu'],
  },
  {
    id: 'cardiacIntervals',
    titleKey: 'docs.signalThemeCardiac',
    descriptionKey: 'docs.signalThemeCardiacDesc',
    rowIds: ['hr', 'ppi', 'rr', 'hrv_rmssd', 'lf_hf'],
  },
  {
    id: 'rawSignals',
    titleKey: 'docs.signalThemeRaw',
    descriptionKey: 'docs.signalThemeRawDesc',
    rowIds: ['raw_ppg', 'acc', 'skin_temp'],
  },
  {
    id: 'appUsage',
    titleKey: 'docs.signalThemeAppUsage',
    descriptionKey: 'docs.signalThemeAppUsageDesc',
    rowIds: ['hr', 'ppi', 'rr', 'hrv_rmssd', 'lf_hf', 'raw_ppg', 'acc', 'skin_temp'],
  },
];

export function getSignalRowsForTheme(themeId: PolarSignalThemeId): PolarSignalRow[] {
  const theme = POLAR_SIGNAL_THEMES.find((t) => t.id === themeId);
  if (!theme) {
    return [];
  }
  return theme.rowIds
    .map((id) => POLAR_SIGNAL_ROWS.find((row) => row.id === id))
    .filter((row): row is PolarSignalRow => row != null);
}
