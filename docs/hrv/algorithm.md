# Algoritmo HRV / LF-HF (Polar 360, Loop, H10)

## Sorgenti e `rrSource`

| Dispositivo | Sorgente | `rrSource` | Beat Ably |
|-------------|----------|------------|-----------|
| Polar 360 / Loop Gen 2 | PPI da PPG | `ppi` | sì (`beats` delta) |
| Polar H10 | RR ECG nativi | `ecg_rr` | no (`rrsMs` per tick) |
| Fallback | `60000/HR` | `hr_derived` | no (mai in Estesa) |

## Pipeline 360 / Loop (PPI)

1. **Classificazione per beat**
   - Fuori 300–2000 ms → `kind = out_of_physiological_range` (escluso da X)
   - `errorEstimate` > 20 ms (LF/HF) → `quality_rejected` (resta in X, Y interpolato)
   - RMSSD usa soglia più stretta (10 ms)
   - In modalità Estesa, `blocker === true` → `quality_rejected`
2. **Timeline X**: somma cumulativa dei PPI inclusi (accepted + quality_rejected)
3. **Correzione salti** ≥ 200 ms: interpolazione in-place
4. **Resample** lineare 4 Hz su `[ppiTimesSec[0], ppiTimesSec[last]]` (no extrapolazione)
5. **Detrend** mean subtraction, finestra Hann, periodogramma one-sided
6. **Bande**: LF `[0.04, 0.15)`, HF `[0.15, 0.40]` Hz; unità **ms²**
7. **Retention** raw 310–360 s; `lfHfValid` richiede dominio ricampionato ≥ 300 s + qualità

Codice: `features/hrv/core/hrv-calculator.ts`, `features/hrv/ppi/ppi-sample-window.ts`.

Dettaglio del calcolo spettrale: [lf-hf-calculation.md](./lf-hf-calculation.md). Errore rispetto all'H10: [../lf-hf-accuracy-vs-h10.md](../lf-hf-accuracy-vs-h10.md).

## Pipeline H10 (ECG RR)

- RR nativi da notifica BLE (`rrsMs`), accettazione 300–2000 ms
- Epoch 5 minuti in Estesa; stessa funzione spettrale
- Nessun `errorEstimate` / `blocker` / beat PPI nel contratto Ably

## Qualità LF/HF (`lfHfStatus`)

`unavailable` → `warming_up` → `low_quality` → `provisional` → `valid`.

`lfHfValid` (legacy) è equivalente a `lfHfStatus === "valid"`. Live e Ably pubblicano potenze con status (anche se non `valid`), dopo che RMSSD è pronto.

## Movimento (`blocker`)

Flag per campione del SDK Polar PPI. Unico indicatore di movimento usato oggi (accelerometro non acquisito).

- **Live**: avviso UI; non cambia `kind`
- **Estesa**: scarta il beat (`quality_rejected`)
- **Motion gate (entrambe le modalità)**: se negli ultimi 120 s della finestra PPI ≥ 95% dei beat ha `blocker=true` (almeno 20 beat), `lfHfStatus` diventa `low_quality` e `lfHfValid` false. Solo stato: LF, HF, rapporto e serie corretta non cambiano, quindi `hrv-1` resta riproducibile; il replay applica lo stesso gate perché `blocker` è nella tupla del beat. Motivazione e dati: [validation log, test 11](../lf-hf-validation-log.md)
- Nel contratto v2: colonna `blocker` per beat + `blocker: true` opzionale sul tick

## Modalità Live vs Estesa, epoch e frame

- **Live (`client`)**: finestra rolling ~30 battiti per RMSSD; LF/HF su buffer 310–360 s
- **Estesa (`clinical`)**: epoch 5 min pulita; timeout acquisizione 8 min
- **`ep`**: +1 a ogni reset finestra (cambio modalità, timeout/nuova epoch, connect/disconnect)
- **`frameId`**: +1 a ogni frame PPI del sensore; LF/HF si calcola una volta per frame

## Cosa non è ricalcolabile dai beat

- `hr` e `skinTemperatureC` (dal sensore)
- Contatto pelle
- Fallback `hr_derived`
