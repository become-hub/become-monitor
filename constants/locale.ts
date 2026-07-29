export type Language = 'it' | 'en';

export interface LocaleStrings {
    // Common
    common: {
        loading: string;
        error: string;
        success: string;
        cancel: string;
        confirm: string;
        save: string;
        delete: string;
        edit: string;
        close: string;
        back: string;
        next: string;
        done: string;
        retry: string;
        search: string;
        filter: string;
        sort: string;
        refresh: string;
        settings: string;
        help: string;
        about: string;
    };

    // Navigation
    navigation: {
        home: string;
        monitor: string;
        docs: string;
        settings: string;
    };

    // Home Screen
    home: {
        title: string;
        subtitle: string;
        connectDevice: string;
        lastSession: string;
        noData: string;
        startMonitoring: string;
    };

    // Monitor Screen
    monitor: {
        title: string;
        connectPolar360: string;
        searchPolar360: string;
        disconnectDevice: string;
        deviceConnected: string;
        deviceDisconnected: string;
        searchingDevices: string;
        noDevicesFound: string;
        connectionError: string;
        heartRate: string;
        hrv: string;
        signalQuality: string;
        batteryLevel: string;
        recording: string;
        stopRecording: string;
        sessionTime: string;
    };

    // Docs Screen
    docs: {
        title: string;
        subtitle: string;
        gettingStarted: string;
        appOverview: string;
        appOverviewDescription: string;
        deviceConnection: string;
        deviceConnectionDescription: string;
        polar360SetupGuide: string;
        keyFeatures: string;
        heartRateMonitoring: string;
        heartRateMonitoringDescription: string;
        hrvAnalysis: string;
        hrvAnalysisDescription: string;
        cloudIntegration: string;
        cloudIntegrationDescription: string;
        technicalSpecs: string;
        hrvMetrics: string;
        hrvMetricsDescription: string;
        supportedDevices: string;
        supportedDevicesDescription: string;
        deviceGuides: string;
        polar360ConnectionGuide: string;
        polar360GuideDescription: string;
        viewPolar360Guide: string;
        muse2ConnectionGuide: string;
        muse2GuideDescription: string;
        viewMuse2Guide: string;
        deviceComparison: string;
        deviceComparisonIntro: string;
        signalThemeSensing: string;
        signalThemeSensingDesc: string;
        signalThemeCardiac: string;
        signalThemeCardiacDesc: string;
        signalThemeRaw: string;
        signalThemeRawDesc: string;
        signalThemeAppUsage: string;
        signalThemeAppUsageDesc: string;
        signalMetric: string;
        signalPolar360: string;
        signalPolarLoop: string;
        signalPolarH10: string;
        signalMuse2: string;
        signalNotes: string;
        signalUsedInApp: string;
        signalUsedYes: string;
        signalUsedNo: string;
        signalUsedDerived: string;
        signalUsedNa: string;
        signalSensingPrinciple: string;
        signalEcg: string;
        signalEeg: string;
        signalHr: string;
        signalPpi: string;
        signalRr: string;
        signalHrvRmssd: string;
        signalLfHf: string;
        signalEegBands: string;
        signalRawPpg: string;
        signalRawEcg: string;
        signalAcc: string;
        signalSkinTemp: string;
        signalFtu: string;
        signalNoteSensing: string;
        signalNoteEcg: string;
        signalNoteEeg: string;
        signalNoteHr: string;
        signalNotePpi: string;
        signalNoteRr: string;
        signalNoteHrv: string;
        signalNoteLfHf: string;
        signalNoteEegBands: string;
        signalNoteRawPpg: string;
        signalNoteRawEcg: string;
        signalNoteAcc: string;
        signalNoteSkinTemp: string;
        signalNoteFtu: string;
        resources: string;
        becomeHubWebsite: string;
        becomeSupport: string;
        troubleshooting: string;
        connectionIssues: string;
        connectionIssuesDescription: string;
        dataQuality: string;
        dataQualityDescription: string;
    };

    // Settings Screen
    settings: {
        title: string;
        language: string;
        languageDescription: string;
        selectLanguage: string;
        italian: string;
        english: string;
        theme: string;
        themeDescription: string;
        light: string;
        dark: string;
        system: string;
        notifications: string;
        notificationsDescription: string;
        enableNotifications: string;
        soundEffects: string;
        hapticFeedback: string;
        about: string;
        aboutDescription: string;
        version: string;
        privacy: string;
        terms: string;
        support: string;
    };
}

export const translations: Record<Language, LocaleStrings> = {
    it: {
        common: {
            loading: 'Caricamento...',
            error: 'Errore',
            success: 'Successo',
            cancel: 'Annulla',
            confirm: 'Conferma',
            save: 'Salva',
            delete: 'Elimina',
            edit: 'Modifica',
            close: 'Chiudi',
            back: 'Indietro',
            next: 'Avanti',
            done: 'Fatto',
            retry: 'Riprova',
            search: 'Cerca',
            filter: 'Filtra',
            sort: 'Ordina',
            refresh: 'Aggiorna',
            settings: 'Impostazioni',
            help: 'Aiuto',
            about: 'Informazioni',
        },
        navigation: {
            home: 'Home',
            monitor: 'Monitor',
            docs: 'Documentazione',
            settings: 'Impostazioni',
        },
        home: {
            title: 'Augmented Monitor',
            subtitle: 'Monitoraggio HRV professionale',
            connectDevice: 'Collega Dispositivo',
            lastSession: 'Ultima Sessione',
            noData: 'Nessun dato disponibile',
            startMonitoring: 'Inizia Monitoraggio',
        },
        monitor: {
            title: 'Monitor HRV',
            connectPolar360: 'Collega Polar 360',
            searchPolar360: 'Cerca Polar 360',
            disconnectDevice: 'Disconnetti Dispositivo Polar 360',
            deviceConnected: 'Dispositivo Connesso',
            deviceDisconnected: 'Dispositivo Disconnesso',
            searchingDevices: 'Ricerca dispositivi...',
            noDevicesFound: 'Nessun dispositivo trovato',
            connectionError: 'Errore di connessione',
            heartRate: 'Frequenza Cardiaca',
            hrv: 'HRV',
            signalQuality: 'Qualità Segnale',
            batteryLevel: 'Livello Batteria',
            recording: 'Registrazione',
            stopRecording: 'Ferma Registrazione',
            sessionTime: 'Tempo Sessione',
        },
        docs: {
            title: 'Documentazione',
            subtitle: 'Impara come usare Augmented Monitor efficacemente',
            gettingStarted: 'Iniziare',
            appOverview: 'Panoramica App',
            appOverviewDescription: 'Augmented Monitor è un\'app professionale per il monitoraggio della variabilità della frequenza cardiaca (HRV) progettata per atleti, professionisti della salute ed entusiasti del benessere.',
            deviceConnection: 'Connessione Dispositivo',
            deviceConnectionDescription: 'Collega un Polar (360 / Loop / H10) o un Muse 2 via Bluetooth. Dopo la scansione scegli il device dall\'elenco (un device alla volta). Polar: HR/HRV/RR (+ FTU su 360/Loop). Muse: EEG, bande e HR da PPG. A fine sessione Polar, Ably endSession può flushare il tracciato PPI grezzo.',
            polar360SetupGuide: 'Guida Setup Polar',
            keyFeatures: 'Caratteristiche Principali',
            heartRateMonitoring: 'Monitoraggio Frequenza Cardiaca',
            heartRateMonitoringDescription: 'Tracciamento della frequenza cardiaca in tempo reale con rilevamento del contatto e indicatori di qualità del segnale.',
            hrvAnalysis: 'Analisi HRV',
            hrvAnalysisDescription: 'Calcoli HRV avanzati inclusi RMSSD, analisi potenza LF/HF per una valutazione completa del sistema nervoso autonomo.',
            cloudIntegration: 'Integrazione Cloud',
            cloudIntegrationDescription: 'Trasmissione sicura dei dati a Become Hub per analisi, archiviazione e approfondimenti professionali.',
            technicalSpecs: 'Specifiche Tecniche',
            hrvMetrics: 'Metriche HRV',
            hrvMetricsDescription: '• RMSSD (Root Mean Square of Successive Differences)\n• Potenza LF (Low Frequency)\n• Potenza HF (High Frequency)\n• Analisi finestra scorrevole di 30 secondi',
            supportedDevices: 'Dispositivi Supportati',
            supportedDevicesDescription: '• Polar 360\n• Polar Loop Gen 2\n• Polar H10 (ECG, RR nativi)\n• Muse 2 (EEG 4 canali, bande, HR da PPG)\n\n360 e Loop: PPG ottico + FTU. H10: ECG toracico. Muse 2: BLE GATT diretto (niente Mind Monitor / Polar Flow).',
            deviceGuides: 'Guide Connessione Dispositivi',
            polar360ConnectionGuide: 'Guida Connessione Polar',
            polar360GuideDescription: 'Guida passo-passo per Polar 360, Loop Gen 2 e H10: scansione, selezione dispositivo, FTU (360/Loop), autenticazione Become e streaming.',
            viewPolar360Guide: 'Visualizza Guida Polar',
            deviceComparison: 'Confronto dispositivi',
            deviceComparisonIntro: 'Differenze scientifiche tra Polar e Muse 2. Espandi un tema per la tabella.',
            signalThemeSensing: 'Sensing e FTU',
            signalThemeSensingDesc: 'Principio di misura e First Time Use obbligatorio.',
            signalThemeCardiac: 'Intervalli cardiaci, HRV e bande EEG',
            signalThemeCardiacDesc: 'HR, PPI, RR e bande EEG Muse derivate in-app.',
            signalThemeRaw: 'Segnali grezzi SDK',
            signalThemeRawDesc: 'PPG grezzo, ECG, accelerometro e temperatura cute disponibili via SDK/protocollo.',
            signalThemeAppUsage: 'Cosa usa Augmented Monitor',
            signalThemeAppUsageDesc: 'Segnali streammati e metriche calcolate oggi nell\'app.',
            signalMetric: 'Segnale / metrica',
            signalPolar360: 'Polar 360',
            signalPolarLoop: 'Polar Loop Gen 2',
            signalPolarH10: 'Polar H10',
            signalMuse2: 'Muse 2',
            signalNotes: 'Note scientifiche',
            signalUsedInApp: 'In app',
            signalUsedYes: 'Sì',
            signalUsedNo: 'No',
            signalUsedDerived: 'Derivata',
            signalUsedNa: '—',
            signalSensingPrinciple: 'Principio di sensing',
            signalEcg: 'ECG',
            signalEeg: 'EEG (4 canali)',
            signalHr: 'HR (BPM)',
            signalPpi: 'PPI / PP interval',
            signalRr: 'RR (ms)',
            signalHrvRmssd: 'HRV (RMSSD)',
            signalLfHf: 'LF / HF power',
            signalEegBands: 'Bande EEG (δ θ α β γ)',
            signalRawPpg: 'PPG grezzo',
            signalRawEcg: 'ECG grezzo (µV)',
            signalAcc: 'Accelerometro',
            signalSkinTemp: 'Temperatura cute',
            signalFtu: 'FTU obbligatorio',
            signalNoteSensing: 'PPG ottico (Polar) o EEG dry electrodes + PPG fronte (Muse 2) — non sono lo stesso segnale.',
            signalNoteEcg: 'ECG a contatto (H10); wristband 360/Loop usano PPG; Muse 2 misura EEG, non ECG.',
            signalNoteEeg: 'EEG 4 canali Muse (TP9/AF7/AF8/TP10) via BLE GATT diretto (~256 Hz).',
            signalNoteHr: 'Battiti/minuto: da PPG (360/Loop/Muse) o HR+RR nativi ECG (H10).',
            signalNotePpi: 'Intervallo pulse-to-pulse (ms) da PPG; base per HRV e tracciato offline 360/Loop. Assente su H10/Muse.',
            signalNoteRr: 'RR(ms): da PPI (360/Loop), da rrsMs ECG (H10), altrimenti 60000/HR solo se non c\'è grezzo.',
            signalNoteHrv: 'Calcolo app (RMSSD) su finestra RR — non metrica nativa device.',
            signalNoteLfHf: 'Stima spettrale in-app su finestra di intervalli RR (Polar); Muse espone bande EEG relative.',
            signalNoteEegBands: 'Potenza relativa delta/theta/alpha/beta/gamma stimata su finestra EEG AF7.',
            signalNoteRawPpg: 'Segnale AFE grezzo Polar; Muse 2 ha 3 stream PPG (ambient/IR/red) usati per HR.',
            signalNoteRawEcg: 'Ultimo campione µV da startEcgStreaming; mostrato in Monitor solo su H10.',
            signalNoteAcc: 'Movimento / activity. Non usato in UI corrente (né Polar né Muse MVP).',
            signalNoteSkinTemp: 'Skin temperature (1–4 Hz) su 360/Loop; assente su H10/Muse.',
            signalNoteFtu: 'Dati antropometrici via SDK (360/Loop) prima delle misure 24/7; H10 e Muse non richiedono FTU.',
            muse2ConnectionGuide: 'Guida Connessione Muse 2',
            muse2GuideDescription: 'Guida per collegare Muse 2: scansione BLE, EEG, bande e HR da PPG (senza Mind Monitor).',
            viewMuse2Guide: 'Visualizza Guida Muse 2',
            resources: 'Risorse',
            becomeHubWebsite: 'Sito Web Become Hub',
            becomeSupport: 'Supporto Become',
            troubleshooting: 'Risoluzione Problemi',
            connectionIssues: 'Problemi di Connessione',
            connectionIssuesDescription: '• Assicurati che il Bluetooth sia abilitato\n• Controlla il livello della batteria del dispositivo\n• Riavvia l\'app se necessario\n• Cancella i dati di autenticazione memorizzati',
            dataQuality: 'Qualità Dati',
            dataQualityDescription: '• Assicurati un buon contatto con la pelle\n• Evita movimenti durante la misurazione\n• Controlla interferenze da altri dispositivi\n• Consenti 30 secondi per letture stabili',
        },
        settings: {
            title: 'Impostazioni',
            language: 'Lingua',
            languageDescription: 'Seleziona la lingua dell\'applicazione',
            selectLanguage: 'Seleziona Lingua',
            italian: 'Italiano',
            english: 'Inglese',
            theme: 'Tema',
            themeDescription: 'Scegli il tema dell\'interfaccia',
            light: 'Chiaro',
            dark: 'Scuro',
            system: 'Sistema',
            notifications: 'Notifiche',
            notificationsDescription: 'Gestisci le notifiche dell\'app',
            enableNotifications: 'Abilita Notifiche',
            soundEffects: 'Effetti Sonori',
            hapticFeedback: 'Feedback Aptico',
            about: 'Informazioni',
            aboutDescription: 'Informazioni sull\'applicazione',
            version: 'Versione',
            privacy: 'Privacy',
            terms: 'Termini',
            support: 'Supporto',
        },
    },
    en: {
        common: {
            loading: 'Loading...',
            error: 'Error',
            success: 'Success',
            cancel: 'Cancel',
            confirm: 'Confirm',
            save: 'Save',
            delete: 'Delete',
            edit: 'Edit',
            close: 'Close',
            back: 'Back',
            next: 'Next',
            done: 'Done',
            retry: 'Retry',
            search: 'Search',
            filter: 'Filter',
            sort: 'Sort',
            refresh: 'Refresh',
            settings: 'Settings',
            help: 'Help',
            about: 'About',
        },
        navigation: {
            home: 'Home',
            monitor: 'Monitor',
            docs: 'Documentation',
            settings: 'Settings',
        },
        home: {
            title: 'Augmented Monitor',
            subtitle: 'Professional HRV monitoring',
            connectDevice: 'Connect Device',
            lastSession: 'Last Session',
            noData: 'No data available',
            startMonitoring: 'Start Monitoring',
        },
        monitor: {
            title: 'HRV Monitor',
            connectPolar360: 'Connect Polar 360',
            searchPolar360: 'Search Polar 360',
            disconnectDevice: 'Disconnect Polar 360 Device',
            deviceConnected: 'Device Connected',
            deviceDisconnected: 'Device Disconnected',
            searchingDevices: 'Searching devices...',
            noDevicesFound: 'No devices found',
            connectionError: 'Connection error',
            heartRate: 'Heart Rate',
            hrv: 'HRV',
            signalQuality: 'Signal Quality',
            batteryLevel: 'Battery Level',
            recording: 'Recording',
            stopRecording: 'Stop Recording',
            sessionTime: 'Session Time',
        },
        docs: {
            title: 'Documentation',
            subtitle: 'Learn how to use Augmented Monitor effectively',
            gettingStarted: 'Getting Started',
            appOverview: 'App Overview',
            appOverviewDescription: 'Augmented Monitor is a professional heart rate variability (HRV) monitoring app designed for athletes, health professionals, and wellness enthusiasts.',
            deviceConnection: 'Device Connection',
            deviceConnectionDescription: 'Connect a Polar (360 / Loop / H10) or Muse 2 via Bluetooth. After scanning, pick the device from the list (one device at a time). Polar: HR/HRV/RR (+ FTU on 360/Loop). Muse: EEG, bands, and PPG HR. At Polar session end, Ably endSession can flush the raw PPI track.',
            polar360SetupGuide: 'Polar Setup Guide',
            keyFeatures: 'Key Features',
            heartRateMonitoring: 'Heart Rate Monitoring',
            heartRateMonitoringDescription: 'Real-time heart rate tracking with contact detection and signal quality indicators.',
            hrvAnalysis: 'HRV Analysis',
            hrvAnalysisDescription: 'Advanced HRV calculations including RMSSD, LF/HF power analysis for comprehensive autonomic nervous system assessment.',
            cloudIntegration: 'Cloud Integration',
            cloudIntegrationDescription: 'Secure data transmission to Become Hub for analysis, storage, and professional insights.',
            technicalSpecs: 'Technical Specifications',
            hrvMetrics: 'HRV Metrics',
            hrvMetricsDescription: '• RMSSD (Root Mean Square of Successive Differences)\n• LF Power (Low Frequency)\n• HF Power (High Frequency)\n• 30-second rolling window analysis',
            supportedDevices: 'Supported Devices',
            supportedDevicesDescription: '• Polar 360\n• Polar Loop Gen 2\n• Polar H10 (ECG, native RR)\n• Muse 2 (4-ch EEG, bands, PPG HR)\n\n360 and Loop: optical PPG + FTU. H10: chest ECG. Muse 2: direct BLE GATT (no Mind Monitor / Polar Flow).',
            deviceGuides: 'Device Connection Guides',
            polar360ConnectionGuide: 'Polar Connection Guide',
            polar360GuideDescription: 'Step-by-step guide for Polar 360, Loop Gen 2, and H10: scan, device selection, FTU (360/Loop), Become auth, and streaming.',
            viewPolar360Guide: 'View Polar Guide',
            deviceComparison: 'Device comparison',
            deviceComparisonIntro: 'Scientific differences between Polar and Muse 2. Expand a theme for the table.',
            signalThemeSensing: 'Sensing and FTU',
            signalThemeSensingDesc: 'Measurement principle and required First Time Use.',
            signalThemeCardiac: 'Cardiac intervals, HRV and EEG bands',
            signalThemeCardiacDesc: 'HR, PPI, RR, and Muse EEG bands derived in-app.',
            signalThemeRaw: 'Raw SDK signals',
            signalThemeRawDesc: 'Raw PPG, ECG, accelerometer, and skin temperature via SDK/protocol.',
            signalThemeAppUsage: 'What Augmented Monitor uses',
            signalThemeAppUsageDesc: 'Signals streamed and metrics computed in the app today.',
            signalMetric: 'Signal / metric',
            signalPolar360: 'Polar 360',
            signalPolarLoop: 'Polar Loop Gen 2',
            signalPolarH10: 'Polar H10',
            signalMuse2: 'Muse 2',
            signalNotes: 'Scientific notes',
            signalUsedInApp: 'In app',
            signalUsedYes: 'Yes',
            signalUsedNo: 'No',
            signalUsedDerived: 'Derived',
            signalUsedNa: '—',
            signalSensingPrinciple: 'Sensing principle',
            signalEcg: 'ECG',
            signalEeg: 'EEG (4 channels)',
            signalHr: 'HR (BPM)',
            signalPpi: 'PPI / PP interval',
            signalRr: 'RR (ms)',
            signalHrvRmssd: 'HRV (RMSSD)',
            signalLfHf: 'LF / HF power',
            signalEegBands: 'EEG bands (δ θ α β γ)',
            signalRawPpg: 'Raw PPG',
            signalRawEcg: 'Raw ECG (µV)',
            signalAcc: 'Accelerometer',
            signalSkinTemp: 'Skin temperature',
            signalFtu: 'FTU required',
            signalNoteSensing: 'Optical PPG (Polar) or dry-electrode EEG + forehead PPG (Muse 2) — different modalities.',
            signalNoteEcg: 'Chest-contact ECG (H10); 360/Loop use PPG; Muse 2 measures EEG, not ECG.',
            signalNoteEeg: 'Muse 4-channel EEG (TP9/AF7/AF8/TP10) via direct BLE GATT (~256 Hz).',
            signalNoteHr: 'Beats per minute from PPG (360/Loop/Muse) or native HR+RR from ECG (H10).',
            signalNotePpi: 'Pulse-to-pulse interval (ms) from PPG; basis for HRV and offline track on 360/Loop. Not on H10/Muse.',
            signalNoteRr: 'RR(ms): from PPI (360/Loop), from native ECG rrsMs (H10), else 60000/HR only when no raw RR.',
            signalNoteHrv: 'App calculation (RMSSD) on an RR window — not a native device metric.',
            signalNoteLfHf: 'In-app spectral estimate on RR (Polar); Muse exposes relative EEG bands.',
            signalNoteEegBands: 'Relative delta/theta/alpha/beta/gamma power estimated on an AF7 EEG window.',
            signalNoteRawPpg: 'Polar raw AFE PPG; Muse 2 has 3 PPG streams (ambient/IR/red) used for HR.',
            signalNoteRawEcg: 'Latest µV sample from startEcgStreaming; shown in Monitor on H10 only.',
            signalNoteAcc: 'Motion / activity. Not used in current UI (Polar or Muse MVP).',
            signalNoteSkinTemp: 'Skin temperature (1–4 Hz) on 360/Loop; not on H10/Muse.',
            signalNoteFtu: 'Anthropometric data via SDK (360/Loop) before 24/7 measures; H10 and Muse do not require FTU.',
            muse2ConnectionGuide: 'Muse 2 Connection Guide',
            muse2GuideDescription: 'Guide to connect Muse 2: BLE scan, EEG, bands, and PPG HR (no Mind Monitor).',
            viewMuse2Guide: 'View Muse 2 Guide',
            resources: 'Resources',
            becomeHubWebsite: 'Become Hub Website',
            becomeSupport: 'Become Support',
            troubleshooting: 'Troubleshooting',
            connectionIssues: 'Connection Issues',
            connectionIssuesDescription: '• Ensure Bluetooth is enabled\n• Check device battery level\n• Restart the app if needed\n• Clear stored authentication data',
            dataQuality: 'Data Quality',
            dataQualityDescription: '• Ensure good skin contact\n• Avoid movement during measurement\n• Check for interference from other devices\n• Allow 30 seconds for stable readings',
        },
        settings: {
            title: 'Settings',
            language: 'Language',
            languageDescription: 'Select application language',
            selectLanguage: 'Select Language',
            italian: 'Italian',
            english: 'English',
            theme: 'Theme',
            themeDescription: 'Choose interface theme',
            light: 'Light',
            dark: 'Dark',
            system: 'System',
            notifications: 'Notifications',
            notificationsDescription: 'Manage app notifications',
            enableNotifications: 'Enable Notifications',
            soundEffects: 'Sound Effects',
            hapticFeedback: 'Haptic Feedback',
            about: 'About',
            aboutDescription: 'Application information',
            version: 'Version',
            privacy: 'Privacy',
            terms: 'Terms',
            support: 'Support',
        },
    },
};

export const getCurrentLanguage = (): Language => {
    // For now, hardcoded to Italian as requested
    return 'it';
};

export const getStrings = (language: Language = getCurrentLanguage()): LocaleStrings => {
    return translations[language];
};
