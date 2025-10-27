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
            title: 'Become Monitor',
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
            subtitle: 'Impara come usare Become Monitor efficacemente',
            gettingStarted: 'Iniziare',
            appOverview: 'Panoramica App',
            appOverviewDescription: 'Become Monitor è un\'app professionale per il monitoraggio della variabilità della frequenza cardiaca (HRV) progettata per atleti, professionisti della salute ed entusiasti del benessere.',
            deviceConnection: 'Connessione Dispositivo',
            deviceConnectionDescription: 'Collega il tuo dispositivo Polar (H10, OH1, Verity Sense, Polar 360) via Bluetooth per iniziare il monitoraggio in tempo reale della frequenza cardiaca e HRV.',
            polar360SetupGuide: 'Guida Setup Polar 360',
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
            supportedDevicesDescription: '• Polar H10 (Fascia toracica)\n• Polar OH1 (Sensore ottico)\n• Polar Verity Sense (Sensore ottico)\n• Compatibile Bluetooth Low Energy (BLE)',
            deviceGuides: 'Guide Connessione Dispositivi',
            polar360ConnectionGuide: 'Guida Connessione Polar 360',
            polar360GuideDescription: 'Guida completa passo-passo per collegare il tuo dispositivo Polar 360 a Become Monitor, inclusi setup iniziale, risoluzione problemi e autenticazione.',
            viewPolar360Guide: 'Visualizza Guida Polar 360',
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
            title: 'Become Monitor',
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
            subtitle: 'Learn how to use Become Monitor effectively',
            gettingStarted: 'Getting Started',
            appOverview: 'App Overview',
            appOverviewDescription: 'Become Monitor is a professional heart rate variability (HRV) monitoring app designed for athletes, health professionals, and wellness enthusiasts.',
            deviceConnection: 'Device Connection',
            deviceConnectionDescription: 'Connect your Polar device (H10, OH1, Verity Sense, Polar 360) via Bluetooth to start real-time heart rate and HRV monitoring.',
            polar360SetupGuide: 'Polar 360 Setup Guide',
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
            supportedDevicesDescription: '• Polar H10 (Chest strap)\n• Polar OH1 (Optical sensor)\n• Polar Verity Sense (Optical sensor)\n• Bluetooth Low Energy (BLE) compatible',
            deviceGuides: 'Device Connection Guides',
            polar360ConnectionGuide: 'Polar 360 Connection Guide',
            polar360GuideDescription: 'Complete step-by-step guide for connecting your Polar 360 device to Become Monitor, including initial setup, troubleshooting, and authentication.',
            viewPolar360Guide: 'View Polar 360 Guide',
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
