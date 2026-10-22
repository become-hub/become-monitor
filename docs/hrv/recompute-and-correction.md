# Ricalcolo e correzione di una sessione

Modulo: `features/hrv/recompute/`. Il grezzo (`beats`, tick, `sessionMeta`) **non si modifica mai**.

## Flusso

1. **Ingest** — ordina eventi, deduplica `seq`, raggruppa per `ep` / `frameId`
2. **Integrità** — buchi di `seq`, `windowCrc`, `sessionEnd`, epoch senza meta; riempimento opzionale da `ppiTrack`
3. **Registro** — `algoVersion` → parametri congelati (`hrv-1`, …)
4. **Replay** — per ogni epoch/frame: stessa `appendPpiSample` / `slidePpiWindow` / `computeLfHfFromIntervals`
   - `faithful`: usa `kind` salvato (deve riprodurre i valori live)
   - `reclassify`: ricalcola `kind` da `ppiMs` / `errorEstimate` / `blocker`
5. **Confronto** — scostamento vs `lfPower` / `hfPower` dei tick
6. **Correzioni** — `exclude_blocker`, soglia `errorEstimate`, maschere `seq`, cambio modalità; output con `recomputeVersion` + `inputHash`

## Modello DB consigliato

| Tabella | Chiave | Note |
|---------|--------|------|
| `hr_ticks` | `(sid, timestamp)` | Scalari del tick |
| `beats` | unique `(sid, seq)` | Append-only |
| `session_meta` | `(sid, ep)` | Una riga per epoch |
| `session_end` | `sid` | Completezza |
| `recompute_results` | `(sid, recomputeVersion)` | Derivati etichettati |

## Checklist post-rilascio (field check)

1. Registrare una sessione reale ≥ 5 min
2. Dal DB: ingest → integrity (nessun buco o buchi riempiti da `ppiTrack`)
3. Replay `faithful`: `lfDiff` / `hfDiff` = 0 sui tick con potenze
4. Verificare `sessionEnd.beatCount` e un `windowCrc`
5. Opzionale: `correctSession` con `exclude_blocker` e confrontare lo spettro

## Consumer Hub / web (pre-rilascio)

Verificare che nessuno legga dal tick live: `ppisMs`, `rrsMs`, `rrMs`, `ppiMs`, `lfHfRatio`, `lfHfValid`, `deviceId`, `deviceModel`. Quei campi sono in `sessionMeta` o derivabili. Questo repo non contiene il Hub: la verifica va fatta sul codice del backend / web app.
