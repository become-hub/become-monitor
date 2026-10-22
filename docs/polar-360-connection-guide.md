# Guida al Collegamento dei dispositivi Polar con Augmented Monitor

Allineata alla documentazione ufficiale Polar BLE SDK
([Polar360.md](https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/products/Polar360.md),
[FirstTimeUse.md](https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/FirstTimeUse.md)).

> **Nota availability:** Polar H10 e Muse 2 restano integrati nel codice (SDK / GATT / catalogo) ma sono **spenti** per connect / pair / UI tramite [`constants/device-availability.ts`](../constants/device-availability.ts) (`polar_h10: false`, `muse_2: false`). Per riattivarli, impostare i flag a `true`.

## Dispositivi compatibili

Dispositivi supportati (attivi in app):

- **Polar 360**
- **Polar Loop Gen 2**

360 e Loop condividono lo stesso profilo SDK di base (PPG ottico, HR, PPI, ACC, FTU).

| | P.360 | P.Loop2 |
|--|-------|---------|
| Temperatura cute | No | Sì |

## Requisiti preliminari

- Polar 360 o Loop Gen 2 carico / con batteria sufficiente.
- **Smartphone Android 13 o superiore** (API 33+): versioni precedenti non consentono l'installazione dell'app.
- Bluetooth attivo.
- App Augmented Monitor installata (versione corrente: **1.2.0**).
- Connessione Internet stabile (per autenticazione Become / Ably).
- Consenso ai permessi richiesti: Bluetooth, notifiche (per lo streaming a schermo spento).
- **Non** usare Polar Flow durante il collegamento con Augmented Monitor (chiudere Flow se aperta).
- **Non** abbinare il Polar dalle Impostazioni Bluetooth di sistema: il pairing va fatto dall'app SDK.

## Guida rapida (allineata alla modale in-app)

1. **Factory reset** — Attacca il Polar al caricatore e verifica che i LED ruotino. Con una graffetta premi il tastino nascosto dietro al cinturino (parte alta).
2. Tieni premuto **circa 5 secondi**, poi rilascia.
3. Attendi che i LED si riaccendano e riprendano a ruotare.
4. Stacca il device e **indossalo** sul polso a contatto con la pelle.
5. In Augmented Monitor, tab **Monitor** → **«Cerca dispositivo Polar»**.
6. **Seleziona** il dispositivo dall’elenco.
7. Acconsenti a **tutti** i permessi richiesti (Bluetooth, notifiche, ecc.).
8. Alla **prima connessione**, se tutto è ok, compare il pannello **«Inserisci il codice a 4 cifre sul PC»**.
9. Inserisci le 4 cifre sul PC: collegamento completato, pronti per lo **streaming**.

> In Docs → Guida Connessione Polar la stessa procedura si apre in una **modale** nell’app (non come link esterno).

## 1. Prima accensione

1. Collega il dispositivo al cavo di ricarica per alcuni minuti.
2. Quando i LED rossi iniziano a ruotare, significa che il dispositivo è acceso.
3. Indossalo sul polso, preferibilmente a contatto diretto con la pelle.

Se i LED mostrano l'animazione di "Waiting for First time use", è normale: Augmented Monitor esegue automaticamente il First Time Use (`doFirstTimeUse`) al primo collegamento.

## 2. Collegamento all'app Augmented Monitor

1. Assicurati di essere entro **1 metro** dal telefono (verifica di prossimità in pairing).
2. Apri l'app Augmented Monitor.
3. Consenti all'app i permessi Bluetooth e, se richiesto, le **notifiche**.
4. Vai su **Monitor** e avvia **"Cerca Dispositivo Polar"**.
5. Quando compaiono i Polar supportati nell’elenco, **seleziona** quello che vuoi usare (360 o Loop). L’app **non** si connette automaticamente al primo trovato.
6. Al primo collegamento l'app:
   - completa il pairing BLE
   - esegue il **First Time Use** (configurazione dispositivo via SDK) e, se necessario, **riavvia** il Polar
   - alla riconnessione **dello stesso** `deviceId` avvia lo streaming verso Become
   - avvia **offline recording PPI** sul Polar (tracciato grezzo in memoria device); se fallisce, accumula un buffer live in-app
   - calcola il tracciato **RR** (da PPI, altrimenti `60000/HR` solo se non c’è grezzo)
   - avvia un **servizio in primo piano** con notifica persistente (dispositivo collegato + HR, HRV, LF, HF), così lo streaming continua anche a schermo bloccato

### Live vs flush a fine sessione (spike)

- **Live**: le card Monitor HR / RR / HRV (e skin temp su Loop) si aggiornano a **1 Hz** appena parte lo streaming locale, anche **prima** del login Become. **LF/HF** (UI + Ably) partono solo quando **HRV è pronta** (Live: 30 battiti; Estesa: epoch), così si evita lo spettro instabile dei primi secondi. Ably (`heartRate`) **parte** solo dopo auth **e** quando HRV è pronta; **dopo il primo invio** resta a 1 Hz per tutta la sessione BLE (vedi [Continuità heartRate](#continuità-heartrate-ably)). I campioni PPI grezzi restano sul device/track; Contatto / Errore PPI / Movimento restano live.
- **Analisi HRV (Settings)**: **Live** (unica modalità selezionabile oggi) e **Estesa** (disabilitata: compatibile solo con Polar H10, non selezionabile). Estesa resta nel codice per epoch da 5 min / H10; non è certificazione medicale.

| | Live | Estesa |
|---|---|---|
| Finestra RMSSD (`hrv`) | 30 intervalli RR/PPI (rolling) | epoch **5 minuti** di intervalli accettati |
| Finestra LF/HF (360/Loop) | buffer PPI SDK (retention 310–360 s); PSD su `resampledDurationSec`; LF/HF in UI/Ably solo dopo HRV pronta, poi con `lfHfStatus`; `lfHfValid` solo se dominio ricampionato ≥ 300 s + qualità stretta | stessa finestra; gate `blocker` |
| Pubblicazione HRV | a finestra 30 piena, continua | solo a epoch valida; poi riparte una nuova epoch |
| Pubblicazione LF/HF | Live **1 Hz** ripubblica l’ultimo spettro (`lfHfComputedAt`); calcolo solo su frame PPI | idem |
| 360 / Loop (PPI) | RMSSD: `errorEstimate` ≤ 10 ms; LF/HF: ≤ 20 ms | come Live **e** senza `blocker` (movimento) |
| H10 (RR ECG) | tutti gli RR in 300–2000 ms | stessa accettazione, epoch 5 min |
| Fallback `hr_derived` (60000/HR) | solo se lo stream PPI è morto | **mai** |
| Timeout | — | se in **8 min** wall-clock non si completa l’epoch pulita → epoch non valida e ripartenza |
- **Tracciato intero**: a fine sessione Hub pubblica su `private:{userId}` l’evento Ably **`endSession`** (payload opzionale `{ "sessionId": "..." }`). L’app:
  1. ferma l’offline recording PPI, scarica il record dal Polar (o usa il buffer live)
  2. costruisce un payload grezzo `ppiTrack` (sample con `ppiMs`/`hr`, `rrMs`, `rrSource`)
  3. fa **POST** a `EXPO_PUBLIC_TRACK_UPLOAD_URL` con `Authorization: Bearer {authToken}`
  4. rimuove il record offline dal device dopo upload ok
- Se `EXPO_PUBLIC_TRACK_UPLOAD_URL` è vuoto, lo spike fa **dry-run** (solo log).
- In Monitor, con **debug mode** attivo, è disponibile il bottone **“Simula endSession / Flush track”** per test senza Hub.

Esempio payload Ably live `heartRate` (360 / Loop):

```json
{
  "deviceId": "...",
  "deviceModel": "polar_loop",
  "hr": 74,
  "signalStale": false,
  "staleSinceMs": null,
  "hrv": 42,
  "lfPower": 1200,
  "hfPower": 800,
  "lfHfRatio": 1.5,
  "lfHfValid": true,
  "lfHfStatus": "valid",
  "lfHfAcceptedRatio": 0.93,
  "lfHfMaxArtifactGapSec": 1.8,
  "lfHfComputedAt": 1700000300000,
  "rrMs": 812,
  "rrSource": "ppi",
  "ppiMs": 812,
  "ppisMs": [800, 810, 805, 812],
  "rrsMs": [800, 810, 805, 812],
  "rrAvailable": true,
  "ppiTimesSec": [0.8, 1.61, 2.415, 3.227],
  "rawIncludedPpiMs": [800, 810, 805, 812],
  "correctedPpiSeries": [800, 810, 805, 812],
  "tachogramSamples": [
    { "timeSec": 0.8, "rawPpiMs": 800, "correctedPpiMs": 800, "kind": "accepted", "jumpCorrected": false }
  ],
  "ppiSamples": [
    { "ppiMs": 800, "errorEstimate": 5, "timestamp": 1700000000000, "rejectReason": null, "kind": "accepted" },
    { "ppiMs": 810, "errorEstimate": 4, "timestamp": 1700000000800, "rejectReason": null, "kind": "accepted" }
  ],
  "includedIntervalDurationSec": 300.5,
  "tachogramDomainSec": 299.7,
  "resampledDurationSec": 299.7,
  "hrvWindowSeconds": 300.5,
  "hrvIntervalCount": 4,
  "hrvMethod": "periodogram",
  "hrvSamplingHz": 4,
  "livePublishHz": 1,
  "lfBandHz": [0.04, 0.15],
  "hfBandHz": [0.15, 0.4],
  "hrvPreprocessing": { "unit": "ms2", "method": "periodogram", "samplingHz": 4, "livePublishHz": 1 },
  "skinTemperatureC": 33.4,
  "contactStatus": true,
  "contactStatusSupported": true,
  "errorEstimate": 5,
  "blocker": false,
  "ppgQuality": null,
  "correctedHr": null,
  "appVersion": "v1.2.2",
  "type": "heartRate",
  "code": "deviceCode",
  "timestamp": "ISO"
}
```

Note:

- `deviceModel` è un `PolarProductId` (`polar_360` | `polar_loop` | `polar_h10`), o `null` se il nome BLE non risolve; Hub può mapparlo a `POLAR_PRODUCTS[id].displayName`.
- `timestamp` è aggiunto da `AblyService.sendMessage` (non c'è un campo `date` duplicato).
- `rrSource` è `"ppi"` (preferito), `"hr_derived"` in fallback, o `"ecg_rr"` su dispositivi ECG.
- `ppiMs` / `rrMs` sono l'ultimo intervallo usabile; con `rrSource === "ppi"` **non** si fabbrica una serie ripetendo quel valore.
- `ppisMs` / `rrsMs` (quando `rrSource === "ppi"`) sono la serie **Y corretta** (compat Hub). **Da soli non bastano** per ricalcolare LF/HF: serve anche `ppiTimesSec` (X da PPI raw inclusi) o `tachogramSamples`. `rrAvailable` è `true` se la serie ha ≥ 2 intervalli. Non sono RR ECG.
- Live publish è a **1 Hz** (`livePublishHz: 1`): ripubblica l’ultimo LF/HF senza aggiungere PPI al buffer. `lfHfComputedAt` è quando è stato calcolato lo spettro (frame PPI), distinto dal `timestamp` Ably del tick Live.
- `ppiSamples` elenca ogni PPI del buffer con `errorEstimate`, `timestamp` wall, `rejectReason` / `kind` (`accepted` | `quality_rejected` | `out_of_physiological_range`).
- Pipeline: X = timeline cumulativa dei PPI **inclusi** (accepted + quality_rejected); Y = valori corretti/interpolati; out_of_physiological_range **esclusi** (non avanzano X). Resample lineare **4 Hz** solo su `[ppiTimesSec[0], ppiTimesSec[last]]` (no extrapolazione). Periodogramma Hann one-sided; LF `f ≥ 0.04 && f < 0.15`, HF `f ≥ 0.15 && f ≤ 0.40` (0.15 solo HF). Unità **ms²**.
- Tre durate: `includedIntervalDurationSec` = sum(included)/1000; `tachogramDomainSec` = last−first X; `resampledDurationSec` = dominio PSD. `lfHfValid` richiede `resampledDurationSec ≥ 300` più accepted ≥ 150, ratio ≥ 0.75, `maxArtifactGapSec ≤ 5`, timeline monotona. Retention raw 310–360 s: 310 s **non garantisce** validità se molti out_of_range.
- LF/HF live (UI + Ably) partono **solo dopo HRV pronta**; prima restano "—" / `null` e `lfHfStatus: "unavailable"`. Poi restano pubblicati con uno spettro e `lfHfStatus` (anche se `lfHfValid` è false). Vedi [Qualità LF/HF](#qualità-lfhf-monitor). I consumer che vogliono solo valori standard Task Force (5 min) filtrano su `lfHfStatus === "valid"`.
- RMSSD (`hrv`) resta sulla finestra Live da 30 battiti; LF/HF sul buffer PPI SDK (ma non esposti finché RMSSD non è pronto).
- `skinTemperatureC` è valorizzato **solo su Loop Gen 2** (stream SDK); su Polar 360 è sempre `null`.
- Finché HRV (RMSSD) non è pronta non parte alcun `heartRate` su Ably e LF/HF restano `null`. Dopo il primo tick valido, vedi [Continuità heartRate](#continuità-heartrate-ably).
- Salti successivi ≥ 200 ms: Y interpolato (stesso limite RMSSD).

### Continuità heartRate (Ably)

- **Gate di partenza** (invariato): auth Become (`authToken` + `userId` + `deviceCode`), `hr > 0`, HRV pronta (Live ≈ 30 battiti; Muse senza gate HRV).
- **Latch**: al primo `heartRate` inviato con successo la sessione si “blocca” sul publish a **1 Hz**. Da quel momento il gate non si riapplica: ogni tick manda un evento finché la sessione BLE è attiva.
- **Segnale perso** (bracciale tolto, contatto perso, `hr = 0` dopo grace): le metriche UI si azzerano, ma Ably continua con `hr: 0`, `hrv` / LF/HF / serie PPI a `null`, `signalStale: true`, `staleSinceMs` (ms dall’inizio del periodo stale). Quando il segnale torna, `hr` riprende subito; `hrv` resta `null` finché la finestra non è di nuovo piena.
- **Stop definitivo** solo su: disconnect BLE, disconnect manuale, logout / reset auth, o evento Hub `endSession` (il latch si azzera; un nuovo warm-up riparte se il device resta collegato).
- **Presence** (`private:<userId>`, azione `enter`): `data` è `{ "deviceCode": "...", "deviceName": "Polar 360 E5BEEB29" }`; `deviceName` è `null` se il nome non è ancora noto.
- **Contatore eventi (Monitor → Streaming)**: accanto allo stato compare il numero di `heartRate` **confermati da Ably** nella sessione BLE (azzerato a disconnect / logout / `endSession`); se Ably ne rifiuta qualcuno compare anche `N✕`. Toccando il badge si apre l’ultimo evento inviato (JSON formattato; le serie lunghe sono riassunte, il payload reale non cambia).
- **Limite dimensione messaggio**: Ably rifiuta i publish sopra **65 536 byte** (errore `40009`, lato server: l’app non se ne accorge). Con la finestra PPI piena (310–360 s) il payload completo supera il limite, quindi `buildPolarAblyHeartRatePayload` lo porta sotto **60 000 byte** togliendo (→ `null`) una serie alla volta, in quest’ordine: `resampledSeries`, `ppiSamples`, `rawIncludedPpiMs`, `rrsMs`, `tachogramSamples`, `correctedPpiSeries`, `ppiTimesSec`, `ppisMs`. `hr`, `hrv`, LF/HF e metadati restano sempre. `payloadTrimmed` elenca le serie tolte (`null` se il payload è completo): i consumer che ricalcolano LF/HF devono controllarlo (per il ricalcolo bastano `ppiTimesSec` + `correctedPpiSeries`, oppure `tachogramSamples`).
- **Disconnect Ably transitorio** (`connecting` / `disconnected`): l’app continua a chiamare `channel.publish`; l’SDK Ably accoda i messaggi (`queueMessages`) e li invia alla riconnessione. Si scarta solo se non c’è client Ably o lo stato è `failed` / `closed` / `suspended`.
- In Monitor, con latch attivo e segnale perso, lo stato streaming mostra **«Connesso · segnale perso»**.
- Su **360 / Loop**, nel buffer LF/HF accepted se `errorEstimate` ≤ 20 ms (`LF_HF_PPI_ERROR_ESTIMATE_MAX_MS`; in Estesa anche senza `blocker`); `hrvPreprocessing.errorEstimateMaxMs` riporta 20. Il RMSSD resta a ≤ 10 ms. Sopra 20 ms: `kind: "quality_rejected"` (resta in X, Y interpolato). Fuori 300–2000 ms: `out_of_physiological_range` (escluso da X). La card **Errore PPI** diventa rossa solo con `errorEstimate` > 30 ms.
- Su **H10**, la sorgente è RR ECG (`rrSource: "ecg_rr"`); `ppisMs` / `ppiSamples` restano `null` e `rrsMs` è la serie ECG nativa.
- `contactStatus` / `contactStatusSupported` preferiscono il skin contact dello stream **PPI**; se il PPI non lo supporta, usano la notifica BLE Heart Rate.
- `errorEstimate` (ms) e `blocker` sull'ultimo tick arrivano dal campione PPI; per-beat restano in `ppiSamples`.
- `ppgQuality` / `correctedHr` arrivano dalla notifica BLE Heart Rate (spesso `null` su 360/Loop). L'app **non** avvia `startHrStreaming` in parallelo al PPI.
- `appVersion` è la versione marketing dell'app (`v` + valore da `app.json` / Expo config).
- In Monitor, sotto le card principali, compaiono card compatte **Contatto** / **Errore PPI** / **Movimento**. Senza contatto pelle (o con `errorEstimate` > 30 ms) compare l'alert rosso **«Sistema bene il bracciale»**; con `blocker` (movimento) compare un alert distinto ambra **«Resta fermo»**.

### Qualità LF/HF (Monitor)

LF e HF non arrivano dalla SDK Polar: la SDK (`polar-ble-sdk` 5.16) in live espone solo dati grezzi (HR, PPI, PPG, ACC, ECG, temperatura…). L'unico dato HRV già elaborato è il Nightly Recharge (RMSSD medio notturno), che arriva a fine notte e non contiene LF/HF. L'app quindi **stima** LF/HF dai **PPI della SDK** (intervalli battito-battito), come fanno Polar Flow e Kubios.

In Monitor, tocca le card **LF Power** o **HF Power** (360/Loop) per aprire una modale con questa nota (percentuale da `LF_HF_VS_ECG_TYPICAL_ERROR_PCT`): «LF e HF non arrivano dal bracciale: vengono interpretati come stima dai battiti misurati al polso. Possono scostarsi di circa ±35% rispetto a una fascia al petto (es. Polar H10). Servono soprattutto per vedere se salgono o scendono nella stessa sessione, non come valori precisi al singolo numero.» Dettaglio tecnico: [lf-hf-validation-log.md](lf-hf-validation-log.md).

LF e HF diventano visibili/trasmessi **dopo che HRV (RMSSD) è pronta** (Live: ~30 battiti). Prima restano "—": le prime finestre di spettro sono troppo corte e gonfiano i valori. Dopo, la qualità dice quanto fidarsi del numero.

#### Livelli di qualità

| Qualità in app | `lfHfStatus` (Ably) | Quando | Vibrazione alla salita |
|---|---|---|---|
| — | `unavailable` | non c'è ancora uno spettro (pochissimi battiti) | — |
| **Bassa** | `warming_up` | segnale ok ma meno di 2 minuti di dati | 1 impulso |
| **Bassa** | `low_quality` | battiti buoni < 60% **oppure** buco più lungo > 10 s | 1 impulso |
| **Media** | `provisional` | almeno 2 minuti, battiti buoni ≥ 60%, buco ≤ 10 s | 2 impulsi |
| **Ottima** | `valid` | standard 5 min: ≥ 5:00, battiti buoni ≥ 75%, buco ≤ 5 s, ≥ 150 battiti buoni | 3 impulsi |

- Le card mostrano l'unità con la qualità: "ms² · bassa qualità", "ms² · media qualità", "ms² · ottima qualità".
- Su 360/Loop le card compatte sono in griglia 2×2: **LF/HF** | **Errore PPI**, poi **Contatto** | **Movimento**. Il rapporto numerico va anche su Ably come `lfHfRatio`; le etichette di plausibilità (0,2–5 plausibile · 5–10 da controllare · 10–20 molto insolito · 20–50 sospetto · >50 probabile artefatto) restano **solo UI**. Tocca la card **LF/HF** per aprire la modale con le soglie e un breve hint per fascia (evidenzia quella del valore attuale).
- Il telefono **vibra solo quando il livello sale** (anche dopo una ricaduta); le discese sono silenziose. Se i battiti buoni oscillano intorno al 60% il passaggio Bassa ↔ Media può vibrare più volte.
- Il nome tecnico su Ably resta `lfHfStatus`; i nomi Bassa/Media/Ottima esistono solo in app.

#### I tre requisiti e la barra di progresso

Sotto le card LF/HF c'è l'accordion **"Qualità LF/HF · Bassa/Media/Ottima"**: chiuso mostra solo titolo, percentuale e barra complessiva (anche a 100% quando la qualità è Ottima); espanso mostra i requisiti e l'hint. La percentuale grande è il progresso verso il livello successivo ed è data dal **requisito messo peggio**. Aperti, una riga per requisito:

| Requisito | Cosa misura | Verso Media | Verso Ottima |
|---|---|---|---|
| **Battiti buoni** | % di battiti della finestra con errore PPI ≤ 20 ms | ≥ 60% | ≥ 75% |
| **Buco più lungo** | tratto più lungo di battiti consecutivi sostituiti (scartati o saltati) | ≤ 10 s | ≤ 5 s |
| **Durata finestra** | secondi di segnale su cui è calcolato lo spettro | 2:00 | 5:00 |

Colori: verde con ✓ = requisito soddisfatto; arancione = manca solo tempo; rosso = blocca la qualità del segnale (compare anche un consiglio su come indossare il bracciale).

#### Durata finestra: perché si ferma a ~5:09

LF/HF sono calcolati su una **finestra mobile** degli ultimi ~5 minuti di battiti. Quando ne arrivano di nuovi, i più vecchi escono. La finestra è trattenuta tra 310 e 360 s di battiti (minimo 300 s per lo standard dei 5 minuti più un piccolo margine), quindi la "Durata finestra" sale fino a **circa 5:09–5:10 e poi resta lì**: non è un blocco.

- Dopo ~5 minuti la durata è soddisfatta in modo permanente (5:09 > 5:00); da lì conta **solo la qualità**.
- La finestra scorre: un tratto rumoroso esce dal calcolo dopo ~5 minuti. Per lo stesso motivo la % di battiti buoni **risale lentamente** dopo un tratto rumoroso: deve aspettare che quei battiti escano.

#### Come vengono trattati i battiti con errore PPI alto

Ogni PPI della SDK porta `errorEstimate` (errore stimato in ms) e `blocker` (flag movimento/contatto).

| Battito | Classificazione | Effetto sul calcolo |
|---|---|---|
| `errorEstimate` ≤ 20 ms, 300–2000 ms | `accepted` | usato così com'è |
| `errorEstimate` > 20 ms | `quality_rejected` | il suo valore **non** entra nello spettro: viene sostituito da una retta tra i battiti buoni vicini; la sua durata resta sulla linea del tempo, così i battiti successivi restano agli istanti giusti |
| fuori 300–2000 ms | `out_of_physiological_range` | eliminato del tutto (non avanza la linea del tempo) |
| salto ≥ 200 ms rispetto al battito buono precedente | corretto | valore interpolato come sopra |

- In modalità **client** `blocker` non scarta nulla. In modalità **Estesa** scarta anche i battiti con `blocker=true`.
- Il valore di `blocker` è quello grezzo della SDK (`PolarPpiSample.getBlockerBit()`). Su Polar 360 può risultare acceso su quasi tutti i battiti in una sessione e quasi mai in un'altra.
- La card **Errore PPI** diventa rossa solo oltre 30 ms. Soglie di calcolo: **20 ms per LF/HF**, **10 ms per RMSSD** (non ancora validato contro ECG).

**Attenzione a LF/HF con qualità Bassa.** Una retta tra due battiti buoni appiattisce le oscillazioni, soprattutto quelle veloci di HF. Più battiti vengono sostituiti, più LF e HF sono **sottostimati** (HF di più, quindi LF/HF tende a essere sovrastimato). Con qualità Bassa il numero non è solo meno preciso: è sbilanciato verso il basso.

#### Validazione contro H10 (ECG)

Registro completo di tutti i test (motivi, metodo, risultati, decisioni): [lf-hf-validation-log.md](lf-hf-validation-log.md).

Sessione del 21/10/2026: Polar 360 (questa app) e Polar H10 (Polar Sensor Logger, RR ECG) indossati insieme, seduti e fermi, ~9 minuti. Stessi ultimi 300 s, stesso calcolo LF/HF dell'app per entrambe le serie:

| Sorgente | LF (ms²) | HF (ms²) | LF/HF | Battiti buoni |
|---|---|---|---|---|
| **H10 ECG (riferimento)** | **2994** | **689** | **4.35** | 100% |
| 360, soglia ≤ 10 ms (precedente) | 251 (−92%) | 29 (−96%) | 8.68 | 28% |
| 360, soglia ≤ 15 ms | 956 (−68%) | 198 (−71%) | 4.83 | 55% |
| **360, soglia ≤ 20 ms (attuale)** | **3530 (+18%)** | **696 (+1%)** | **5.08** | 79% |
| 360, soglia ≤ 25–30 ms | 4559 (+52%) | 783 (+14%) | 5.82 | 86% |

Errore del singolo battito 360 rispetto all'ECG (abbinamento per orario ±300 ms, 442/561 battiti):

| `errorEstimate` 360 | Differenza media | Mediana |
|---|---|---|
| 0–10 ms | 36–44 ms | 21–30 ms |
| 11–15 ms | 60 ms | 40 ms |
| 16–20 ms | 98 ms | 81 ms |
| 21–30 ms | 168 ms | 156 ms |
| > 30 ms | 351 ms | 342 ms |

Conclusioni:
- Con 10 ms il 72% dei battiti veniva sostituito da rette e LF/HF risultavano ~10 volte più bassi del vero. Da qui la soglia LF/HF a **20 ms**.
- Con 20 ms, sulla stessa finestra, HF coincide con l'ECG (+1%) e LF è +18%. Oltre 20 ms i battiti errati gonfiano LF.
- Limiti: tre sessioni, un solo soggetto. L'abbinamento battito per battito è approssimativo (il 360 consegna i PPI a gruppi, orari ricostruiti), quindi le differenze per battito sono un limite superiore. Il RMSSD non è stato confrontato.

Seconda sessione (21/10/2026, soglia 20 ms già attiva, HR medio 62 bpm): valori **mostrati live dall'app** confrontati con l'H10 calcolato sulla stessa finestra temporale. Battiti buoni 80–93%, qualità Media da 2:00.

| Momento | Finestra | 360 LF / HF / LF/HF | H10 LF / HF / LF/HF | Differenza |
|---|---|---|---|---|
| 18:21:19 | 2:06 | 2215 / 725 / 3.05 | 3728 / 551 / 6.77 | LF −41%, HF +32%, LF/HF −55% |
| 18:22:52 | 3:39 | 3134 / 610 / 5.14 | 2708 / 406 / 6.67 | LF +16%, HF +50%, LF/HF −23% |
| 18:24:30 | 5:09 | 3813 / 525 / 7.26 | 2653 / 343 / 7.74 | LF +44%, HF +53%, LF/HF −6% |
| 18:25:31 | 5:10 | 3504 / 544 / 6.44 | 2585 / 465 / 5.56 | LF +36%, HF +17%, LF/HF +16% |
| 18:26:04 | 5:09 | 3309 / 612 / 5.40 | 2643 / 548 / 4.82 | LF +25%, HF +12%, LF/HF +12% |

- Con finestra piena (~5 min) il **rapporto LF/HF** del 360 è entro ±16% dall'ECG; **LF e HF assoluti** sono più alti di circa +25–45% e +12–53% (mediana dalle 2:00 in poi: ×1.35 entrambi).
- La sovrastima è attesa: i battiti accettati con errore 11–20 ms aggiungono rumore battito-battito, che si somma alla potenza in tutte le bande. Il rapporto LF/HF ne risente meno perché il rumore cresce in entrambe.
- Prima dei 5 minuti (qualità Media) LF e HF oscillano molto (fino a −41% / +103%): con finestre corte basta un piccolo sfasamento o un tratto rumoroso per spostarli.
Terza sessione (21/10/2026, 18:34–18:43, segnale buono: 94% dei battiti con errore ≤ 20 ms) e riepilogo su finestre di 5 minuti ogni 30 s, regola attuale (≤ 20 ms):

| Sessione | Scarto tipico LF | Scarto tipico HF | Scarto tipico LF/HF |
|---|---|---|---|
| 1 (17:57) | −17% | +35% | −19% |
| 2 (18:19) | +41% | +26% | +12% |
| 3 (18:34) | −32% | +3% | −37% |

- Lo scarto dall'ECG è di circa **±30–40%** su LF e LF/HF e fino a +35% su HF, ma **cambia segno da una sessione all'altra**: non è una sovrastima fissa correggibile con un fattore.
- In pratica: con qualità Media usare LF/HF come indicazione di tendenza; anche con qualità Ottima i valori assoluti del 360 vanno letti con un margine di circa ±35% rispetto a un ECG.

#### Metodi alternativi provati (non adottati)

Sulle sessioni 1–2 sono state provate 11 varianti; la migliore è stata poi verificata sulla sessione 3, registrata dopo la scelta:

- **Pesare i battiti in base all'errore PPI** (spostarli verso la retta tra i battiti buoni vicini): peggiora, perché la retta appiattisce le oscillazioni veloci e HF viene sottostimato fino a −48%.
- **Sottrarre un rumore stimato** dall'errore PPI: con fattore 1 quasi neutro, con fattori maggiori HF crolla.
- **Togliere i picchi** (battito con errore > 10 ms scartato se dista più di 150 ms dalla mediana dei battiti buoni vicini, soglia 25 ms): migliore sulle sessioni 1–2 (punteggio 0.59 contro 0.67), ma **pari sulla sessione 3** (0.94 contro 0.95).

Nessuna variante batte in modo consistente la regola attuale (errore ≤ 20 ms accettato, altrimenti sostituito), che resta in uso.

Per ripetere la prova: H10 con Polar Sensor Logger (stream HR con RR) e 360 in questa app nello stesso momento; si confrontano i file RR della fascia con i PPI del 360 (`ppiSamples` su Ably) sulla stessa finestra di 5 minuti. Procedura in [lf-hf-validation-log.md](lf-hf-validation-log.md#come-ripetere-un-confronto-con-h10).

#### Consigli per salire di qualità

- Bracciale **stretto** sopra l'osso del polso, sensore a pieno contatto con la pelle (non sopra maniche).
- Seduto, braccio appoggiato e **fermo**, senza gesticolare né usare il telefono con quella mano.
- Dopo un movimento, aspetta: la % di battiti buoni risale man mano che il tratto rumoroso esce dalla finestra di ~5 minuti.
- Se la barra "Battiti buoni" resta sotto il 60% anche da fermo, è il segnale ottico a essere debole (molti battiti con errore PPI oltre 20 ms), non un problema di tempo.

#### Campi Ably collegati

| Campo | Significato |
|---|---|
| `lfHfStatus` | `unavailable` / `warming_up` / `low_quality` / `provisional` / `valid` |
| `lfHfValid` | `true` solo con `valid` (standard 5 min) |
| `lfHfAcceptedRatio` | quota battiti buoni nella finestra (0–1) |
| `lfHfMaxArtifactGapSec` | buco più lungo in secondi |
| `resampledDurationSec` | durata finestra usata per lo spettro (max ~309 s) |
| `lfPower` / `hfPower` / `lfHfRatio` | potenze in ms² e rapporto; `null` se HRV non pronta o `unavailable` |

### Verifica LF/HF (esterna)

Per ricalcolare LF/HF da un payload Ably live **non** bastano `ppisMs` / `rrsMs`. Servono `ppiTimesSec` (X, timeline da PPI raw inclusi) e `correctedPpiSeries` (Y), oppure `tachogramSamples`.

Esempio Python (stessa pipeline: interp lineare 4 Hz, mean detrend, Hann simmetrica, PSD densità one-sided, bande LF `[0.04, 0.15)` / HF `[0.15, 0.40]`):

```python
import numpy as np
from scipy.signal import periodogram, get_window

def lf_hf(t, y, fs=4.0):
    t, y = np.asarray(t, float), np.asarray(y, float)
    dur = t[-1] - t[0]
    n = int(np.floor(dur * fs)) + 1
    grid = t[0] + np.arange(n) / fs
    x = np.interp(grid, t, y)
    nfft = 1 << (n - 1).bit_length()
    w = get_window("hann", n, fftbins=False)  # simmetrica, come l'app
    f, p = periodogram(
        x, fs=fs, window=w, nfft=nfft, detrend="constant", scaling="density"
    )
    df = f[1] - f[0]
    lf = p[(f >= 0.04) & (f < 0.15)].sum() * df
    hf = p[(f >= 0.15) & (f <= 0.40)].sum() * df
    return lf, hf
```

Note di confronto:

- Il payload arrotonda `lfPower` / `hfPower` all’**intero** (ms²); confrontare con `round(lf)` / `round(hf)`.
- L’interpolazione **lineare** attenua le sinusoidi ad alta frequenza: a FC bassa l’HF è sottostimato rispetto a una sinusoide continua (bias di metodo, non un bug di FFT).
- **Non** attendersi parità con Kubios (spline cubica 4 Hz, smoothness priors, Welch).

Esempio payload POST:

```json
{
  "type": "ppiTrack",
  "deviceId": "...",
  "deviceCode": "...",
  "userId": 0,
  "sessionId": null,
  "startedAt": "ISO",
  "endedAt": "ISO",
  "source": "polar_offline_ppi",
  "samples": [
    {
      "t": "ISO",
      "ppiMs": 812,
      "hr": 74,
      "errorEstimate": 0,
      "blockerBit": false,
      "rrMs": 812,
      "rrSource": "ppi"
    }
  ]
}
```

### Se il dispositivo non viene trovato

1. Attendi 30 secondi durante la ricerca.
2. Se non appare alcun dispositivo supportato:
   - Disattiva manualmente il Bluetooth dalle impostazioni di sistema.
   - Riattivalo dopo qualche secondo.
   - Ripeti la ricerca nell'app Augmented Monitor.
3. Se il Polar era già abbinato a un altro telefono o a Polar Flow:
   - esegui un **factory reset** (pulsante nascosto sotto il cinturino mentre è in carica, oppure via SDK)
   - su Android, rimuovi eventuali pairing residui dalle impostazioni Bluetooth
   - ripeti la ricerca (il Polar è **1 peer only**: dopo il pairing è invisibile agli altri dispositivi)

## 3. Autenticazione e abbinamento con Become

1. Al primo login su Augmented Monitor verrà richiesto di inserire i 4 codici di connessione.
2. Accedi alla platform web di Become → sezione **/devices**.
3. Aggiungi un nuovo dispositivo Polar e abbinalo al visore.
4. Inserisci i 4 codici visualizzati sull'app.

Una volta completata l'associazione, sull'app Augmented Monitor apparirà un popup verde che conferma la connessione tra app e piattaforma.

### Sessioni per dispositivo

- Ogni Polar (`deviceId`) ha una **sessione auth separata** (token Become / device token).
- Cambiare dispositivo può richiedere una nuova autenticazione se non esiste già una sessione salvata per quel `deviceId`.
- Dopo la migrazione, i token legacy monolitici vengono mappati sul device noto.

### Login e FTU

- L'inserimento dei 4 codici avviene solo la prima volta **per quel device**.
- Il First Time Use sul Polar viene eseguito solo se non è già stato completato (`isFtuDone`).
- Dopo un FTU appena eseguito il Polar **si riavvia**; i LED smettono l'animazione "Waiting for First time use" solo dopo quel riavvio. L'app riparte con scan e riconnessione automatica **allo stesso** device, poi lo streaming.
- FTU (`waitForFtuFeatures` / `performFirstTimeUse` / `restartDevice`), reconnect e PPI sono **building block condivisi** (360 e Loop Gen 2).

## 4. Stato della connessione

Quando tutti i LED diventano verdi, significa che:

- La connessione tra app e dispositivo è attiva.
- Lo streaming dei dati biometrici alla piattaforma è in corso.

**Importante:** durante tutta la procedura, il Polar deve essere indossato.

Durante lo streaming, la barra delle notifiche mostra il nome del Polar collegato e i quattro valori trasmessi (`HR · HRV · LF · HF`). Non chiudere/rimuovere quella notifica: indica che il monitor resta attivo in background.

## Confronto segnali / capacità (scientifico)

Fonte: profilo Polar BLE SDK (360 / Loop). Tabella allineata all’accordion in-app (tab Documentazione).

| Segnale / metrica | P.360 | P.Loop2 | Note scientifiche | Usato oggi in Augmented Monitor |
| --- | --- | --- | --- | --- |
| Principio di sensing | PPG ottico (LED verde) | PPG ottico (stesso profilo SDK) | PPG ottico al polso | Sì |
| ECG | No | No | Wristband PPG, non ECG | — |
| HR (BPM) | Sì (online) | Sì | Da PPG | Sì |
| PPI / PP interval | Sì (da PPG) | Sì | Base HRV time-domain | Sì |
| RR (ms) | Da PPI o `60000/HR` fallback | Idem | `rrSource`: `ppi`, `hr_derived` | Sì |
| HRV (RMSSD) | Derivata da RR/PPI | Derivata da RR/PPI | Calcolo in-app | Sì |
| LF / HF | Da finestra RR | Da finestra RR | Spettrale RR; salti ≥ 200 ms interpolati | Sì |
| PPG grezzo | Sì (SDK) | Stesso profilo SDK | Offline / live track | Sì |
| Accelerometro | Sì | Sì | Fuori scope UI | No |
| Temperatura cute | No | Sì | Solo Loop Gen 2 | Sì (solo Loop) |
| FTU obbligatorio | Sì | Sì | Famiglia 360/Loop | Sì |

## Disconnessione del dispositivo

- Il tasto di disconnessione nell'app interrompe lo stream in modo forzato.
- La disconnessione non rimuove l'abbinamento BLE né lo stato FTU.
- Per ricollegare: **"Cerca Dispositivo Polar"** → seleziona di nuovo il device dall’elenco.

## Risoluzione dei problemi

Se il Polar non si collega correttamente:

1. Chiudi Polar Flow completamente.
2. Spegni e riaccendi manualmente il Bluetooth del telefono.
3. Se resta invisibile o il First Time Use fallisce: factory reset + forget device + riprova entro 1 m.

L'app Augmented Monitor non può riavviare il Bluetooth automaticamente per motivi di sicurezza imposti da Android.

Se LF/HF restano a qualità **Bassa**:

| Sintomo | Causa | Cosa fare |
|---|---|---|
| "Battiti buoni" rossa sotto 60% | troppi PPI con errore > 20 ms (segnale ottico debole o movimento) | stringi il bracciale sopra l'osso del polso, braccio fermo; attendi che il tratto rumoroso esca dalla finestra (~5 min) |
| "Buco più lungo" rossa oltre 10 s | una serie di battiti consecutivi scartati (movimento, bracciale spostato) | resta fermo; il buco sparisce quando esce dalla finestra |
| "Durata finestra" ferma a ~5:09 | comportamento previsto: finestra mobile di ~5 min | nessuna azione; conta solo la qualità |
| LF/HF molto bassi con qualità Bassa | molti battiti sostituiti → LF e HF sottostimati | non usare quel valore come riferimento; attendi qualità Media/Ottima |

Dettagli in [Qualità LF/HF](#qualità-lfhf-monitor).

## Collegamento completato

Il Polar è associato a Augmented Monitor e sta trasmettendo in tempo reale i dati biometrici alla piattaforma.
