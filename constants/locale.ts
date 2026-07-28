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
        signalNotes: string;
        signalUsedInApp: string;
        signalUsedYes: string;
        signalUsedNo: string;
        signalUsedDerived: string;
        signalUsedNa: string;
        signalSensingPrinciple: string;
        signalEcg: string;
        signalHr: string;
        signalPpi: string;
        signalHrvRmssd: string;
        signalLfHf: string;
        signalRawPpg: string;
        signalAcc: string;
        signalSkinTemp: string;
        signalFtu: string;
        signalNoteSensing: string;
        signalNoteEcg: string;
        signalNoteHr: string;
        signalNotePpi: string;
        signalNoteHrv: string;
        signalNoteLfHf: string;
        signalNoteRawPpg: string;
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
            deviceConnectionDescription: 'Collega un Polar 360 o Polar Loop Gen 2 via Bluetooth per iniziare il monitoraggio in tempo reale (HR/HRV). Scegli il dispositivo dall\'elenco dopo la scansione.',
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
            supportedDevicesDescription: '• Polar 360\n• Polar Loop Gen 2\n\nEntrambi usano PPG ottico (non ECG). Fasce petto come H10 non sono integrate in questa app.',
            deviceGuides: 'Guide Connessione Dispositivi',
            polar360ConnectionGuide: 'Guida Connessione Polar',
            polar360GuideDescription: 'Guida passo-passo per Polar 360 e Loop Gen 2: scansione, selezione dispositivo, FTU, autenticazione Become e streaming.',
            viewPolar360Guide: 'Visualizza Guida Polar',
            deviceComparison: 'Confronto dispositivi',
            deviceComparisonIntro: 'Differenze scientifiche tra i Polar integrati (profilo SDK condiviso). Espandi un tema per la tabella.',
            signalThemeSensing: 'Sensing e FTU',
            signalThemeSensingDesc: 'Principio di misura e First Time Use obbligatorio.',
            signalThemeCardiac: 'Intervalli cardiaci e HRV',
            signalThemeCardiacDesc: 'HR, PPI e metriche derivate in-app.',
            signalThemeRaw: 'Segnali grezzi SDK',
            signalThemeRawDesc: 'PPG grezzo, accelerometro e temperatura cute disponibili via SDK.',
            signalThemeAppUsage: 'Cosa usa Augmented Monitor',
            signalThemeAppUsageDesc: 'Segnali streammati e metriche calcolate oggi nell\'app.',
            signalMetric: 'Segnale / metrica',
            signalPolar360: 'Polar 360',
            signalPolarLoop: 'Polar Loop Gen 2',
            signalNotes: 'Note scientifiche',
            signalUsedInApp: 'In app',
            signalUsedYes: 'Sì',
            signalUsedNo: 'No',
            signalUsedDerived: 'Derivata',
            signalUsedNa: '—',
            signalSensingPrinciple: 'Principio di sensing',
            signalEcg: 'ECG',
            signalHr: 'HR (BPM)',
            signalPpi: 'PPI / PP interval',
            signalHrvRmssd: 'HRV (RMSSD)',
            signalLfHf: 'LF / HF power',
            signalRawPpg: 'PPG grezzo',
            signalAcc: 'Accelerometro',
            signalSkinTemp: 'Temperatura cute',
            signalFtu: 'FTU obbligatorio',
            signalNoteSensing: 'PPG ottico a LED verde — non è ECG a contatto toracico.',
            signalNoteEcg: 'ECG tipico di fascia petto (es. H10); non supportato su questi wristband né in app.',
            signalNoteHr: 'Battiti/minuto stimati da PPG (online streaming).',
            signalNotePpi: 'Intervallo pulse-to-pulse (ms) da PPG; base per HRV time-domain.',
            signalNoteHrv: 'Calcolo app (RMSSD) su finestra RR/PPI — non metrica nativa device.',
            signalNoteLfHf: 'Stima spettrale in-app su finestra di intervalli RR.',
            signalNoteRawPpg: 'Segnale AFE grezzo (es. ~22 Hz, 24 bit); richiede resampling. Non streammato in UI.',
            signalNoteAcc: 'Movimento / activity (~50 Hz, ±8 g tipico). Non usato in UI corrente.',
            signalNoteSkinTemp: 'Skin temperature (1–4 Hz). Non usato in UI corrente.',
            signalNoteFtu: 'Dati antropometrici via SDK prima delle misure 24/7; poi restart device.',
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
            deviceConnectionDescription: 'Connect a Polar 360 or Polar Loop Gen 2 via Bluetooth to start real-time monitoring (HR/HRV). Select the device from the list after scanning.',
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
            supportedDevicesDescription: '• Polar 360\n• Polar Loop Gen 2\n\nBoth use optical PPG (not ECG). Chest straps such as H10 are not integrated in this app.',
            deviceGuides: 'Device Connection Guides',
            polar360ConnectionGuide: 'Polar Connection Guide',
            polar360GuideDescription: 'Step-by-step guide for Polar 360 and Loop Gen 2: scan, device selection, FTU, Become auth, and streaming.',
            viewPolar360Guide: 'View Polar Guide',
            deviceComparison: 'Device comparison',
            deviceComparisonIntro: 'Scientific differences between integrated Polar devices (shared SDK profile). Expand a theme for the table.',
            signalThemeSensing: 'Sensing and FTU',
            signalThemeSensingDesc: 'Measurement principle and required First Time Use.',
            signalThemeCardiac: 'Cardiac intervals and HRV',
            signalThemeCardiacDesc: 'HR, PPI, and in-app derived metrics.',
            signalThemeRaw: 'Raw SDK signals',
            signalThemeRawDesc: 'Raw PPG, accelerometer, and skin temperature available via SDK.',
            signalThemeAppUsage: 'What Augmented Monitor uses',
            signalThemeAppUsageDesc: 'Signals streamed and metrics computed in the app today.',
            signalMetric: 'Signal / metric',
            signalPolar360: 'Polar 360',
            signalPolarLoop: 'Polar Loop Gen 2',
            signalNotes: 'Scientific notes',
            signalUsedInApp: 'In app',
            signalUsedYes: 'Yes',
            signalUsedNo: 'No',
            signalUsedDerived: 'Derived',
            signalUsedNa: '—',
            signalSensingPrinciple: 'Sensing principle',
            signalEcg: 'ECG',
            signalHr: 'HR (BPM)',
            signalPpi: 'PPI / PP interval',
            signalHrvRmssd: 'HRV (RMSSD)',
            signalLfHf: 'LF / HF power',
            signalRawPpg: 'Raw PPG',
            signalAcc: 'Accelerometer',
            signalSkinTemp: 'Skin temperature',
            signalFtu: 'FTU required',
            signalNoteSensing: 'Green-LED optical PPG — not chest-contact ECG.',
            signalNoteEcg: 'ECG is typical of chest straps (e.g. H10); not supported on these wristbands or in-app.',
            signalNoteHr: 'Beats per minute estimated from PPG (online streaming).',
            signalNotePpi: 'Pulse-to-pulse interval (ms) from PPG; basis for time-domain HRV.',
            signalNoteHrv: 'App calculation (RMSSD) on an RR/PPI window — not a native device metric.',
            signalNoteLfHf: 'In-app spectral estimate on an RR-interval window.',
            signalNoteRawPpg: 'Raw AFE signal (e.g. ~22 Hz, 24-bit); needs resampling. Not streamed in UI.',
            signalNoteAcc: 'Motion / activity (~50 Hz, ±8 g typical). Not used in current UI.',
            signalNoteSkinTemp: 'Skin temperature (1–4 Hz). Not used in current UI.',
            signalNoteFtu: 'Anthropometric data via SDK before 24/7 measures; then device restart.',
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
