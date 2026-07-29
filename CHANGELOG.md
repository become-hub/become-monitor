# Changelog

Tutte le modifiche rilevanti a Augmented Monitor.

Il formato si ispira a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

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
