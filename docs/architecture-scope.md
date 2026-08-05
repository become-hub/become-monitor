# Architecture scope (Expo + native BLE)

This app is **Expo Router + React Native**, with **Android-only** native modules for Polar SDK and Muse GATT. It is **not** a multi-module Android/KMP Clean Architecture project.

## What applies

| Layer | Location | Role |
|-------|----------|------|
| Presentation | `app/`, `features/*/components/` | Screens and UI |
| Session / orchestration | `features/monitor/hooks/` | BLE listeners, auth, Ably, flush |
| Device catalogs & bridges | `features/devices/{polar,muse}/` | Products, setup helpers, TS ↔ NativeModules |
| Shared I/O | `services/` | Auth, Ably, storage, HRV, upload, Sentry |
| Native BLE | `android/.../polar/`, `muse/`, `bluetooth/` | Thin RN modules + managers |

Import Polar/Muse from `@/features/devices/polar/*` and `@/features/devices/muse/*` (no `services/` re-export shims).

User-facing connect / pair / catalog visibility is gated by [`constants/device-availability.ts`](../constants/device-availability.ts) (H10 and Muse 2 can be off while code stays integrated).

## What the `android-clean-architecture` skill must NOT drive here

Do **not** introduce ECC-style Gradle modules (`domain/`, `data/`, `presentation/`), Hilt/Koin, Room/SQLDelight, or KMP solely to match that skill.

Reasons:

- Polar FTU / PPI offline / H10 RR and Muse GATT are stable behind the current Package + manager layout
- Business orchestration for sessions lives in **TypeScript** (`features/monitor`), not duplicated Kotlin UseCases
- Native modules should stay **thin facades**; managers under `polar/` and `muse/` already separate responsibilities

## Clean Architecture principles we *do* follow (JS-first)

- Dependency direction: UI → hooks/session → device bridges → native
- Feature folders under `features/` for monitor and device families
- No unifying Polar and Muse into one manager
- Capabilities / product branching stays authoritative for streaming and FTU

For new Android Kotlin code: keep additive managers and events; prefer extending `PolarBleModule` / `MuseBleModule` facades over a framework rewrite.
