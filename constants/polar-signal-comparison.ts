/**
 * Confronto scientifico segnali Polar 360 / Loop Gen 2 / H10
 */

export type SignalUsedInApp = 'yes' | 'no' | 'derived' | 'na';

export interface PolarSignalRow {
  id: string;
  metricKey: string;
  polar360: string;
  polarLoop: string;
  polarH10: string;
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
    polarH10: 'ECG a contatto (fascia petto)',
    scientificNoteKey: 'docs.signalNoteSensing',
    usedInApp: 'yes',
  },
  {
    id: 'ecg',
    metricKey: 'docs.signalEcg',
    polar360: 'No',
    polarLoop: 'No',
    polarH10: 'Sì (nativo)',
    scientificNoteKey: 'docs.signalNoteEcg',
    usedInApp: 'na',
  },
  {
    id: 'hr',
    metricKey: 'docs.signalHr',
    polar360: 'Sì (online)',
    polarLoop: 'Sì',
    polarH10: 'Sì (online + RR nativi)',
    scientificNoteKey: 'docs.signalNoteHr',
    usedInApp: 'yes',
  },
  {
    id: 'ppi',
    metricKey: 'docs.signalPpi',
    polar360: 'Sì (da PPG)',
    polarLoop: 'Sì (da PPG)',
    polarH10: 'No',
    scientificNoteKey: 'docs.signalNotePpi',
    usedInApp: 'yes',
  },
  {
    id: 'rr',
    metricKey: 'docs.signalRr',
    polar360: 'Da PPI o 60000/HR',
    polarLoop: 'Da PPI o 60000/HR',
    polarH10: 'RR nativo ECG (`rrsMs`)',
    scientificNoteKey: 'docs.signalNoteRr',
    usedInApp: 'derived',
  },
  {
    id: 'hrv_rmssd',
    metricKey: 'docs.signalHrvRmssd',
    polar360: 'Derivata da PPI/HR',
    polarLoop: 'Derivata da PPI/HR',
    polarH10: 'Derivata da RR ECG grezzi',
    scientificNoteKey: 'docs.signalNoteHrv',
    usedInApp: 'derived',
  },
  {
    id: 'lf_hf',
    metricKey: 'docs.signalLfHf',
    polar360: 'Derivata da finestra RR',
    polarLoop: 'Derivata da finestra RR',
    polarH10: 'Derivata da finestra RR ECG',
    scientificNoteKey: 'docs.signalNoteLfHf',
    usedInApp: 'derived',
  },
  {
    id: 'raw_ppg',
    metricKey: 'docs.signalRawPpg',
    polar360: 'Sì (SDK; ~22 Hz, 24 bit)',
    polarLoop: 'Stesso profilo SDK',
    polarH10: 'No',
    scientificNoteKey: 'docs.signalNoteRawPpg',
    usedInApp: 'no',
  },
  {
    id: 'raw_ecg',
    metricKey: 'docs.signalRawEcg',
    polar360: 'No',
    polarLoop: 'No',
    polarH10: 'Sì (µV, streaming SDK)',
    scientificNoteKey: 'docs.signalNoteRawEcg',
    usedInApp: 'yes',
  },
  {
    id: 'acc',
    metricKey: 'docs.signalAcc',
    polar360: 'Sì (~50 Hz, ±8 g)',
    polarLoop: 'Sì',
    polarH10: 'Sì (SDK; non in UI)',
    scientificNoteKey: 'docs.signalNoteAcc',
    usedInApp: 'no',
  },
  {
    id: 'skin_temp',
    metricKey: 'docs.signalSkinTemp',
    polar360: 'Sì (1–4 Hz)',
    polarLoop: 'Sì',
    polarH10: 'No',
    scientificNoteKey: 'docs.signalNoteSkinTemp',
    usedInApp: 'yes',
  },
  {
    id: 'ftu',
    metricKey: 'docs.signalFtu',
    polar360: 'Obbligatorio',
    polarLoop: 'Obbligatorio',
    polarH10: 'Non richiesto',
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
    rowIds: ['raw_ppg', 'raw_ecg', 'acc', 'skin_temp'],
  },
  {
    id: 'appUsage',
    titleKey: 'docs.signalThemeAppUsage',
    descriptionKey: 'docs.signalThemeAppUsageDesc',
    rowIds: [
      'hr',
      'ppi',
      'rr',
      'hrv_rmssd',
      'lf_hf',
      'raw_ppg',
      'raw_ecg',
      'acc',
      'skin_temp',
    ],
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
