# Dominio HRV (`features/hrv/`)

Riferimento tecnico unico per algoritmo Polar, contratto Ably v2 e ricalcolo di sessione.

## Mappa moduli

| Cartella | Ruolo |
|----------|--------|
| `features/hrv/core/` | Pipeline spettrale (`hrv-calculator`), modalità Live/Estesa (`hrv-analysis-mode`) |
| `features/hrv/ppi/` | Limiti PPI, finestra rolling, RR, beat outbox, checkpoint CRC |
| `features/hrv/contract/` | Tipi e builder Ably v2 (`heartRate`, `sessionMeta`, `sessionEnd`) |
| `features/hrv/recompute/` | Ingest, integrità, replay, correzioni dichiarative |

## Regole di dipendenza

`features/hrv/` è TypeScript puro (nessun React / RN / Expo / Ably / `@/services` / `@/stores` / `@/constants` / `@/features/monitor`). ESLint `no-restricted-imports` lo impone. Valori esterni (es. `appVersion`) entrano come argomenti dei builder.

Direzione: `features/monitor` → `features/hrv`. Nessuno shim: importare sempre `@/features/hrv/...`.

## Documenti

1. [algorithm.md](./algorithm.md) — sorgenti PPI / ECG RR, pipeline, movimento, modalità, epoch/frame
   - [lf-hf-calculation.md](./lf-hf-calculation.md) — calcolo di LF/HF passo per passo (FFT, bande, qualità, costanti)
   - [../lf-hf-accuracy-vs-h10.md](../lf-hf-accuracy-vs-h10.md) — errore misurato rispetto al Polar H10, a riposo e in movimento
2. [ably-contract-v2.md](./ably-contract-v2.md) — eventi, tupla beat, checkpoint, dimensioni
3. [recompute-and-correction.md](./recompute-and-correction.md) — ricalcolo, policy, versionamento, DB

Guida utente (collegamento dispositivo): [../polar-360-connection-guide.md](../polar-360-connection-guide.md).

## Aggiungere una `algoVersion`

1. Congelare i parametri correnti in `features/hrv/recompute/algo-registry.ts` sotto `hrv-N`
2. Bumpare `POLAR_ALGO_VERSION` in `features/hrv/contract/contract-version.ts`
3. Aggiornare il test che verifica che la versione corrente coincide con le costanti live
4. Documentare il cambiamento in questo README e nel CHANGELOG
