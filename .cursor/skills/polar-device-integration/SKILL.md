---
name: polar-device-integration
description: Integrate new Polar BLE devices (catalog, streaming, Monitor UI, docs) without regressing Polar 360 / Loop Gen 2 FTU, PPI, offline recording, or auth flows.
---

# Polar device integration

Use when adding or changing Polar device support in Augmented Monitor (Android).

## Do not break existing products (hard constraint)

Polar **360** and **Loop Gen 2** behavior must stay identical unless explicitly changing those products:

| Area | 360 / Loop (unchanged) | New devices (e.g. H10) |
|------|------------------------|---------------------------|
| FTU | `ensurePolarReady(..., { requireFtu: true })` default | `requireFtu: false` when `capabilities.ftuRequired === false` |
| Live stream | `startPpiStreaming` + HR fallback | Branch on `capabilities` — never call PPI for non-PPI devices |
| Offline track | `startPpiOfflineRecording` + flush fetch/remove | Skip offline PPI; live buffer only |
| Monitor grid | PPI/HR RR cards as today | Extra raw cards only when `capabilities.rawEcg` |
| RR source | `ppi` > `hr_derived` | `ecg_rr` from `rrsMs`; never `60000/HR` if raw RR exists |
| Auth | Per-`deviceId` token in `StorageService` | Same — no auto-connect on scan |

**Rule:** branch on `product.id` / `capabilities`; additive native events and SDK overloads only. No unified manager refactors that change 360/Loop defaults.

**Muse is not Polar:** do not put Muse into this stack. Use [muse-device-integration](../muse-device-integration/SKILL.md) for Muse BLE GATT.

## Checklist — new Polar product

1. **Catalog** — `services/polar-products.ts`
   - Add `PolarProductId`, matchers, `imageKey`, `POLAR_PRODUCT_LIST` entry
   - Set `capabilities` (`ppi`, `ecg`, `rawEcg`, `ftuRequired`, …)
   - Tests in `services/__tests__/polar-products.test.ts`
   - Asset under `assets/images/` + `components/polar-device-card.tsx`

2. **Scan / overview**
   - `stores/scan-store.ts` uses `PolarProductId`
   - Overview tab lists product via `POLAR_PRODUCT_LIST`

3. **Native streaming** (Android)
   - Extend `PolarStreamManager.kt` additively (PPI path untouched)
   - Bridge in `PolarBleModule.kt` + types in `services/polar-ble-sdk.ts`
   - H10 pattern: `startHrStreaming` (RR in `rrsMs`), `startEcgStreaming` (µV)

4. **Setup** — `services/polar-device-setup.ts`
   - `ensurePolarReady(..., { requireFtu })` — default `true`
   - `startPolarStreamingForProduct(product, deviceId, sdk)` — product branch

5. **Monitor** — `app/(tabs)/monitor.tsx`
   - Resolve product from `connectedDeviceName`
   - FTU / PPI / offline / flush only when `capabilities` say so
   - **Prefer raw signals in UI** when `capabilities.rawEcg` or native RR exists
   - Calculated metrics (RMSSD, LF/HF) secondary to raw cards

6. **Track buffer / flush**
   - `services/rr-interval.ts` — extend `RrSource` if needed (`ecg_rr`)
   - `session-track-buffer.ts` — product-specific push helpers
   - `session-track-flush.ts` — `skipOfflinePpi` for non-PPI products

7. **Docs (same PR)** — workspace rule
   - `constants/polar-signal-comparison.ts` + `app/(tabs)/docs.tsx` (column per device)
   - `constants/locale.ts` strings
   - `docs/polar-360-connection-guide.md` (or focused guide)

8. **Tests**
   - Existing FTU/PPI/setup tests must stay green
   - Add separate cases for new product; Kotlin tests for new stream methods

## Capability matrix (reference)

| Signal | 360 / Loop | H10 |
|--------|------------|-----|
| Sensing | PPG | ECG |
| FTU | Yes | No |
| PPI | Yes | No |
| RR | PPI or HR-derived | Native `rrsMs` (`ecg_rr`) |
| Raw ECG µV | No | Yes (Monitor) |
| Offline PPI flush | Yes | No (live buffer only) |

## UI rule

When `capabilities.rawEcg === true`:

- Show **RR (ECG)** and **ECG µV** cards prominently
- Populate HRV window from native RR, not `60000/HR`
- Hide HR-derived RR label when `ecg_rr` is active

## Invariants

- Multi-device auth scoped by `deviceId`
- No auto-connect on scan (except post-FTU reconnect same `deviceId` for 360/Loop)
- Structural changes → update docs in the same commit set
