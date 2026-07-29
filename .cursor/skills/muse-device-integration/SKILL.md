---
name: muse-device-integration
description: Integrate Muse BLE headsets (catalog, Android GATT, Monitor UI, docs) without regressing Polar 360 / Loop Gen 2 / H10 FTU, PPI, offline recording, or auth flows.
---

# Muse device integration

Use when adding or changing Muse (Interaxon) support in Augmented Monitor (Android).

## Hard constraint — do not regress Polar

Muse is a **parallel family**, not an extension of Polar.

| Do | Do not |
|----|--------|
| Add `muse-*` native + JS modules | Put Muse into `polar-products.ts` / `PolarBleModule` / `PolarStreamManager` |
| Branch Monitor connect on `family: 'muse' \| 'polar'` | Refactor Polar managers to “unify” with Muse |
| Reuse auth per-`deviceId`, BT permissions, Ably/FGS when generic | Change `requireFtu` defaults or PPI/offline paths for Polar |
| Keep EEG naming separate from Polar H10 ECG | Call Muse EEG “ECG” or reuse H10 stream APIs |

Before closing: Jest Polar suites green (`polar-products`, `polar-device-setup`, `rr-interval`, setup/stream tests) + smoke Polar unchanged.

See also [polar-device-integration](../polar-device-integration/SKILL.md).

## Architecture (reference)

```text
MonitorUI → family muse → MuseBleModule → Android GATT (service 0xfe8d)
         → family polar → PolarBleModule → Polar BLE SDK
```

- Protocol: community Muse BLE (muse-js / muse-lsl style): control cmds, EEG 4ch, PPG.
- No official Interaxon SDK; no Mind Monitor / OSC requirement.

## Checklist — new Muse product or signal

1. **Catalog** — `features/devices/muse/muse-products.ts`
   - `MuseProductId`, matchers, `capabilities` (`eeg`, `bandPowers`, `ppg`, …)
   - Tests in `services/__tests__/muse-products.test.ts`
   - Asset + `components/muse-device-card.tsx`

2. **Native** — `android/.../muse/`
   - Connection + stream managers; decode in `MuseProtocol.kt`
   - Bridge `MuseBleModule.kt` / `MuseBlePackage` (already registered in `MainApplication`)
   - Unit tests under `android/.../muse/`

3. **JS bridge** — `services/muse-ble-sdk.ts` + `muse-device-setup.ts`
   - `startMuseStreamingForProduct` — no FTU
   - Types: EEG, band powers, PPG, HR

4. **Scan / Monitor**
   - `stores/scan-store.ts`: `family: 'muse'`
   - Dual scan; explicit Muse connect branch; Polar path untouched
   - Cards: EEG channels, bands, PPG HR — not Polar temp/RR on Muse sessions

5. **Ably**
   - Payload additive: `deviceFamily: 'muse'`, bands, `hr` — keep Polar `heartRate` fields for Polar sessions

6. **Docs (same PR)** — workspace structural rule
   - `docs/muse-2-connection-guide.md`
   - `constants/polar-signal-comparison.ts` Muse column + `app/(tabs)/docs.tsx`
   - `constants/locale.ts` + link from Docs tab
   - Update comparison table in `docs/polar-360-connection-guide.md`

7. **Tests**
   - Muse catalog/setup tests
   - Polar regression suites must stay green

## Capability matrix (Muse 2 MVP)

| Signal | Muse 2 |
|--------|--------|
| EEG 4ch | Yes (Monitor) |
| Band powers | Yes (relative δ…γ) |
| PPG / HR | Yes (HR in UI + Ably) |
| Accel / gyro | Protocol possible; **out of UI MVP** |
| FTU | No |
| Offline track | No |

## Out of scope (unless explicitly requested)

- iOS
- Mind Monitor / OSC
- Dual-connect Polar + Muse
- Replacing Polar Hub cardiac metrics with EEG without payload agreement
