# Contratto Ably v2 (Polar)

`schemaVersion: 2`, `algoVersion: "hrv-1"`. Il backend salva il messaggio così com’è.

## Eventi

| Evento | Quando | Contenuto |
|--------|--------|-----------|
| `sessionMeta` | Latch, riconnessione, nuova epoch | Statico: device, modalità, preprocessing, colonne beat |
| `heartRate` | 1 Hz | Scalari live + beat nuovi + `windowFromSeq` (+ CRC ogni 30 tick) |
| `sessionEnd` | Disconnect / endSession | `lastSeq`, `beatCount`, `epochs`, `ticks` |

## Tupla beat

`[seq, ppiMs, errorEstimate, kind, blocker, ep, frameId]`

- `kind`: 0 accepted, 1 quality_rejected, 2 out_of_physiological_range
- `blocker`: 0 / 1
- Niente `tMs` (X = somma PPI inclusi); niente serie corretta (ricalcolabile)

## Semantica “campo assente”

Sul tick: assenza di `signalStale` / `blocker` / `contactStatus` / `hrv` / `lfPower` / `hfPower` / `lfHfStatus` = normale o null (vedi tipi in `features/hrv/contract/types.ts`).

## Outbox / ack / deduplica

I beat vivono in un outbox di sessione (sopravvive ai reset della finestra). Si svuota solo all’ack Ably (`sendMessage` → `Promise<boolean>`). Cap 120 beat/messaggio. Il consumer deduplica su `seq`.

- **Cursore in volo (`inFlightUpTo`)**: dopo l’invio i beat restano nell’outbox ma non vengono rimandati a ogni tick. Durante un outage Ably l’SDK accoda i messaggi e li consegna alla riconnessione: rimandare gli stessi beat in ogni tick moltiplicherebbe i duplicati (e i byte nel DB).
- **Nack**: se `sendMessage` risolve `false` (drop/reject) i beat di quel messaggio tornano selezionabili (`nackFrom`) e vengono rimandati al tick successivo.
- **Segnale perso (`signalStale`)**: il tick non porta beat e non li marca né in volo né confermati; restano in coda.
- **`sessionMeta`**: segnato come inviato subito (niente duplicato a ogni tick) e ripubblicato se Ably lo scarta.
- Un ack/nack tardivo di una sessione precedente (`sid` diverso) viene ignorato: i `seq` ripartono da 1 a ogni sessione.

## Checkpoint

- `windowFromSeq` ogni tick: primo `seq` nella finestra LF/HF
- `windowCrc` + `windowBeatCount` ogni 30 tick: CRC32 di `ppiMs,kind`

## Esempio tick (~250 B)

```json
{
  "sid": "a1b2c3",
  "hr": 74,
  "hrv": 42,
  "lfPower": 1200,
  "hfPower": 800,
  "lfHfStatus": "provisional",
  "windowFromSeq": 903,
  "beats": [[1203, 812, 6, 0, 0, 2, 411]],
  "type": "heartRate",
  "code": "deviceCode",
  "timestamp": "2026-10-22T13:30:52.700Z"
}
```

## Dimensioni

| Scenario | 15 min | 1 h |
|----------|--------|-----|
| Prima (finestra intera) | ~120 MB | ~540 MB |
| v2 (JSON grezzo) | ~0,25–0,30 MB | ~0,9–1,2 MB |

Il limite Ably 64 KiB non è più raggiungibile con questo schema.

## Campi rimossi (non più sul tick)

`ppisMs`, `rrsMs` (360/Loop), `ppiSamples`, `tachogramSamples`, `ppiTimesSec`, `rawIncludedPpiMs`, `correctedPpiSeries`, `resampledSeries`, `rrMs`, `ppiMs`, `lfHfRatio`, `lfHfValid`, `deviceId`, `deviceModel`, `hrvPreprocessing`, bande, ecc. Statici → `sessionMeta`; derivabili → ricalcolo.
