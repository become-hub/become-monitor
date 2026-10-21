# Changelog

Tutte le modifiche rilevanti a Augmented Monitor.

Il formato si ispira a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [1.2.4] — LF/HF live da PPI (360/Loop)

### Added
- LF/HF sempre stimati dai PPI (non letti dalla SDK), con livelli di qualità Bassa / Media / Ottima e vibrazione alla salita
- Barra progresso verso il livello successivo (battiti buoni, buco massimo, durata finestra ~5 min)
- Card rapporto LF/HF in Monitor (griglia con Errore PPI / Contatto / Movimento) e fasce di plausibilità
- Soglia errore PPI dedicata a LF/HF (20 ms; RMSSD resta a 10 ms), allineata al confronto con H10
- Registro validazione vs Polar H10: `docs/lf-hf-validation-log.md`
- Nota in UI su stima al polso e scarto tipico ±35% rispetto a una fascia ECG

### Changed
- LF/HF in UI e su Ably solo dopo HRV pronta (Live: ~30 battiti), per evitare picchi sulle finestre corte
- Payload Ably: `lfHfStatus`, `lfHfAcceptedRatio`, `lfHfMaxArtifactGapSec`, tachogramma/export per ricalcolo esterno
- Guida Polar 360 aggiornata (qualità LF/HF, validazione H10, warm-up)

### Fixed
- Con soglia 10 ms LF/HF del 360 risultavano ~10× troppo bassi rispetto all’ECG; con 20 ms tornano nell’ordine di grandezza corretto

## [1.2.3] — Qualità segnale Polar e HRV Live/Estesa

### Added
- Qualità segnale Polar in Monitor: contatto pelle, stima errore PPI e movimento (blocker)
- Banner indosso sotto le card (contatto debole / resta fermo)
- Modalità analisi HRV in Settings: **Live** (30 battiti) e **Estesa** (epoch ~5 min; UI solo H10, bloccata a dispositivo connesso)
- Progress HRV nel pannello Streaming: spiegazione, barra e % mentre si riempie la finestra
- Versione app nel payload Ably

### Changed
- Calcolo HRV: gate qualità PPI e sostituzione salti anomali prima di RMSSD e LF/HF
- Pubblicazione Ably `heartRate` solo dopo autenticazione e HRV pronto (`hrv > 0`)
- Griglia metriche Polar con note PPI e feedback progresso Live/Estesa
- Rimossi i toggle live rate 1 Hz / 4 Hz dalla UI Settings

## [1.2.2] — Polar live PPI/HRV

### Fixed
- Stream Polar live: PPI in range (300–2000 ms) usati per RR/HRV anche se Polar li marca `blocker`
- `HR=0` ottico non azzera più le metriche (grace 10 s); niente RR derivato da HR (`60000/HR`) mentre lo stream PPI è vivo
- Launch stream Polar abortito sulla disconnect, così un reconnect non resta appeso a un auth in-flight

## [1.2.0] — Device gates + Monitor UX + Polar setup

### Added
- Flag `device-availability` per spegnere H10/Muse in UI senza rimuovere il codice
- Guida setup Polar 360 / Loop Gen 2 in modale in-app (Docs)
- Temperatura cute in Monitor su Loop Gen 2; non in perimetro app sul 360
- Reset metriche e stop pulse cuore quando il sensore non rileva più segnale

### Changed
- Streaming locale (PPI / skin temp) avviato dopo FTU, indipendente dall’auth Become
- Tab Docs: confronto dispositivi a colonne (Sì/No), intestazioni P.360 / P.Loop2
- Heartbeat UI più morbido; polish card Monitor e stato sessione

### Fixed
- Asset PNG Polar (H10/Loop) corretti per build Android AAPT

## [1.1.0] — Feature architecture + CI

### Changed
- Monitor refactor: logica in `features/monitor` (hook di sessione + componenti UI), route sottile
- Device Polar/Muse spostati in `features/devices/*` con re-export da `services/`
- `getApiBaseUrl` spostato in `services/api-config` (niente dipendenza store da `constants/`)

### Added
- Pipeline GitHub Actions (Jest + coverage su push/PR)
- Guida `docs/architecture-scope.md` (scope Clean Architecture su Expo, senza moduli Gradle ECC)

## [1.0.3] — Muse 2

### Added
- Integrazione **Muse 2** (BLE GATT diretto, famiglia device separata da Polar)
- Streaming EEG 4 canali (TP9 / AF7 / AF8 / TP10), bande relative e HR da PPG
- Scan/connect unificato Polar + Muse, card Monitor Muse, guida e tabella device/segnale

## [1.0.2] — Polar H10

### Added
- Integrazione **Polar H10** (ECG a contatto)
- HR + RR nativi (`rrsMs`), ECG grezzo in Monitor; nessun FTU / PPI offline

## [1.0.1] — Polar Loop Gen 2

### Added
- Integrazione **Polar Loop Gen 2** (stesso profilo SDK di Polar 360: PPG, HR, PPI, FTU, skin temp)

## [1.0.0] — Polar 360

### Added
- Prima release con integrazione **Polar 360**
- Collegamento BLE via Polar SDK, FTU, streaming HR/PPI, HRV e live Ably
