/**
 * Confronto scientifico segnali Polar 360 / Loop Gen 2 / H10 / Muse 2
 */

export type SignalUsedInApp = 'yes' | 'no' | 'derived' | 'na';

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
    muse2: 'EEG dry electrodes (4ch) + PPG fronte',
    scientificNoteKey: 'docs.signalNoteSensing',
    usedInApp: 'yes',
  },
  {
    id: 'ecg',
    metricKey: 'docs.signalEcg',
    polar360: 'No',
    polarLoop: 'No',
    polarH10: 'Sì (nativo)',
    muse2: 'No (EEG, non ECG)',
    scientificNoteKey: 'docs.signalNoteEcg',
    usedInApp: 'na',
  },
  {
    id: 'eeg',
    metricKey: 'docs.signalEeg',
    polar360: 'No',
    polarLoop: 'No',
    polarH10: 'No',
    muse2: 'Sì TP9/AF7/AF8/TP10 (~256 Hz)',
    scientificNoteKey: 'docs.signalNoteEeg',
    usedInApp: 'yes',
  },
  {
    id: 'hr',
    metricKey: 'docs.signalHr',
    polar360: 'Sì (online)',
    polarLoop: 'Sì',
    polarH10: 'Sì (online + RR nativi)',
    muse2: 'Sì (da PPG)',
    scientificNoteKey: 'docs.signalNoteHr',
    usedInApp: 'yes',
  },
  {
    id: 'ppi',
    metricKey: 'docs.signalPpi',
    polar360: 'Sì (da PPG)',
    polarLoop: 'Sì (da PPG)',
    polarH10: 'No',
    muse2: 'No',
    scientificNoteKey: 'docs.signalNotePpi',
    usedInApp: 'yes',
  },
  {
    id: 'rr',
    metricKey: 'docs.signalRr',
    polar360: 'Da PPI o 60000/HR',
    polarLoop: 'Da PPI o 60000/HR',
    polarH10: 'RR nativo ECG (`rrsMs`)',
    muse2: 'No (HR da PPG)',
    scientificNoteKey: 'docs.signalNoteRr',
    usedInApp: 'derived',
  },
  {
    id: 'hrv_rmssd',
    metricKey: 'docs.signalHrvRmssd',
    polar360: 'Derivata da PPI/HR',
    polarLoop: 'Derivata da PPI/HR',
    polarH10: 'Derivata da RR ECG grezzi',
    muse2: 'No in UI Muse',
    scientificNoteKey: 'docs.signalNoteHrv',
    usedInApp: 'derived',
  },
  {
    id: 'lf_hf',
    metricKey: 'docs.signalLfHf',
    polar360: 'Derivata da finestra RR',
    polarLoop: 'Derivata da finestra RR',
    polarH10: 'Derivata da finestra RR ECG',
    muse2: 'Bande EEG (delta…gamma)',
    scientificNoteKey: 'docs.signalNoteLfHf',
    usedInApp: 'derived',
  },
  {
    id: 'eeg_bands',
    metricKey: 'docs.signalEegBands',
    polar360: 'No',
    polarLoop: 'No',
    polarH10: 'No',
    muse2: 'Sì (relative power)',
    scientificNoteKey: 'docs.signalNoteEegBands',
    usedInApp: 'yes',
  },
  {
    id: 'raw_ppg',
    metricKey: 'docs.signalRawPpg',
    polar360: 'Sì (SDK; ~22 Hz, 24 bit)',
    polarLoop: 'Stesso profilo SDK',
    polarH10: 'No',
    muse2: 'Sì (3 stream; HR in UI)',
    scientificNoteKey: 'docs.signalNoteRawPpg',
    usedInApp: 'yes',
  },
  {
    id: 'raw_ecg',
    metricKey: 'docs.signalRawEcg',
    polar360: 'No',
    polarLoop: 'No',
    polarH10: 'Sì (µV, streaming SDK)',
    muse2: 'No',
    scientificNoteKey: 'docs.signalNoteRawEcg',
    usedInApp: 'yes',
  },
  {
    id: 'acc',
    metricKey: 'docs.signalAcc',
    polar360: 'Sì (~50 Hz, ±8 g)',
    polarLoop: 'Sì',
    polarH10: 'Sì (SDK; non in UI)',
    muse2: 'Sì (protocollo; non in UI MVP)',
    scientificNoteKey: 'docs.signalNoteAcc',
    usedInApp: 'no',
  },
  {
    id: 'skin_temp',
    metricKey: 'docs.signalSkinTemp',
    polar360: 'Sì (1–4 Hz)',
    polarLoop: 'Sì',
    polarH10: 'No',
    muse2: 'No',
    scientificNoteKey: 'docs.signalNoteSkinTemp',
    usedInApp: 'yes',
  },
  {
    id: 'ftu',
    metricKey: 'docs.signalFtu',
    polar360: 'Obbligatorio',
    polarLoop: 'Obbligatorio',
    polarH10: 'Non richiesto',
    muse2: 'Non richiesto',
    scientificNoteKey: 'docs.signalNoteFtu',
    usedInApp: 'yes',
  },
];

export const POLAR_SIGNAL_THEMES: PolarSignalTheme[] = [
  {
    id: 'sensing',
    titleKey: 'docs.signalThemeSensing',
    descriptionKey: 'docs.signalThemeSensingDesc',
    rowIds: ['sensing_principle', 'ecg', 'eeg', 'ftu'],
  },
  {
    id: 'cardiacIntervals',
    titleKey: 'docs.signalThemeCardiac',
    descriptionKey: 'docs.signalThemeCardiacDesc',
    rowIds: ['hr', 'ppi', 'rr', 'hrv_rmssd', 'lf_hf', 'eeg_bands'],
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
      'eeg',
      'eeg_bands',
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
