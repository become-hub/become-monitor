# Registro validazione LF/HF — Polar 360

Registro di tutte le verifiche fatte su LF/HF calcolati dai PPI del Polar 360: perché sono state fatte, come, cosa è uscito e quali decisioni ne sono seguite. Il comportamento attuale per l'utente è descritto in [Qualità LF/HF](polar-360-connection-guide.md#qualità-lfhf-monitor).

Periodo: 21/10/2026. Dispositivi: Polar 360 (questa app, Android CPH2415), Polar H10 come riferimento ECG. Un solo soggetto, sempre seduto e fermo.

## Riepilogo

| # | Test | Perché | Esito | Decisione |
|---|---|---|---|---|
| 1 | Test unitari: DFT indipendente + ampiezza teorica | Capire se il calcolo dello spettro è verificabile e corretto | Coincide con DFT diretto (< 1e-9) e con la teoria entro il 3% | Calcolo considerato corretto |
| 2 | Prima sessione reale in app | In UI LF/HF restavano "—" | Gate stretti 5 min falliti (battiti buoni 65%, buco 5.3 s, finestra 118 s) | Stato provvisorio live, gate rilassati |
| 3 | Seconda sessione | Ancora "—" con i gate rilassati | Battiti buoni 54%, buco 17.6 s | LF/HF sempre visibili + stato di fiducia |
| 4 | Verifica SDK Polar | "Non possiamo prendere LF/HF dalla SDK?" | La SDK non espone LF/HF | LF/HF restano calcolati dall'app dai PPI |
| 5 | Distribuzione errore PPI / `blocker` | Capire perché metà dei battiti era scartata | 62% dei battiti con errore > 10 ms; `blocker` acceso su 153/156 | Barra di progresso; ipotesi soglia troppo stretta |
| 6 | Sessione con barra di progresso | "Molto difficile arrivare a qualità media" | Qualità peggiorata nel tempo; HF scende con i battiti sostituiti | Documentato il bias da interpolazione |
| 7 | Confronto 360 vs H10 (sessione 1) | Sapere se i valori sono giusti rispetto a un ECG | Con soglia 10 ms LF/HF ~10× troppo bassi; 20 ms vicino all'ECG | Soglia LF/HF a 20 ms (RMSSD resta 10 ms) |
| 8 | Confronto valori live app vs H10 (sessione 2) | "Sono tornati valori alti" | Ordine di grandezza giusto; LF/HF entro ±16% a finestra piena | Soglia 20 ms confermata |
| 9 | Esperimento di pesatura (11 varianti) + prova su sessione 3 | Ridurre lo scarto dall'ECG | Nessuna variante migliore in modo consistente | Nessuna modifica; regola attuale resta |

## 1. Test unitari del calcolo

**Perché.** Prima di qualsiasi prova sul campo serviva sapere se LF/HF potevano essere verificati e se il codice era corretto.

**Come.** In `services/__tests__/hrv-calculator.test.ts`:
- riferimento indipendente: un DFT diretto scritto a parte (interpolazione con ricerca binaria, niente FFT), confrontato con la pipeline dell'app su serie sintetiche e su serie con battiti `quality_rejected` / `out_of_physiological_range`;
- ampiezza attesa: sinusoidi note in banda LF (0.10 Hz) e HF (0.25 Hz, anche a 70 bpm); la potenza attesa è A²/2 moltiplicata per il guadagno dell'interpolazione lineare G = sinc⁴(θ/2), θ = 2π·f·RR;
- Parseval (energia nel tempo = energia nello spettro).

**Esito.** Differenza dal DFT indipendente < 1e-9; ampiezza entro il 3% dalla teoria. Bande Task Force 1996 (LF 0.04–0.15 Hz, HF 0.15–0.40 Hz), unità ms².

**Bias noto, non corretto.** Il ricampionamento lineare a 4 Hz attenua HF tanto più quanto il cuore è lento (a 0.25 Hz: circa −26% a 70 bpm, −46% a 50 bpm).

## 2. Prima sessione reale: LF/HF non visibili

**Perché.** Con l'APK installato la UI mostrava "—" per LF e HF.

**Come.** Logcat, righe `HRV_PSD`.

**Esito.**

```text
HRV_PSD rawPpiCount=165 acceptedPpiCount=107 acceptedRatio=0.648 maxArtifactGapSec=5.32 resampledDurationSec=117.9 lfHfValid=false
```

Non un bug di collegamento: i tre gate stretti (≥ 300 s, ≥ 75% battiti buoni, buco ≤ 5 s) fallivano. I battiti scartati avevano `errorEstimate` 11–21 ms.

**Decisione (scelta dell'utente).** Streaming live invece di attendere 5 minuti: stato provvisorio con gate rilassati (≥ 60%, buco ≤ 10 s). I gate stretti restano solo per `lfHfValid`.

## 3. Seconda sessione: ancora "—"

**Esito.** Dopo ~4 minuti:

```text
acceptedRatio=0.541 maxArtifactGapSec=17.55 resampledDurationSec=244.6 lfHfStatus=unavailable
```

La durata bastava; bloccava solo la qualità.

**Decisione (scelta dell'utente).** LF/HF sempre visibili appena esiste uno spettro; lo stato (`low_quality` / `warming_up` / `provisional` / `valid`) dice solo quanto fidarsi. Aggiunti su Ably `lfHfStatus`, `lfHfAcceptedRatio`, `lfHfMaxArtifactGapSec`.

## 4. La SDK Polar può dare LF/HF?

**Come.** Ispezione delle classi di `polar-ble-sdk` 5.16.0 (`javap` sull'AAR).

**Esito.**
- Stream live: HR, ECG, ACC, PPG, PPI, giroscopio, magnetometro, pressione, posizione, temperatura, temperatura cutanea. Nessun valore HRV in frequenza.
- `PolarNightlyRechargeData`: RMSSD e RRI medi notturni, respirazione, ANS status. Arriva a fine notte, nessun LF/HF.
- `PolarPpiSample`: `ppi`, `errorEstimate`, `hr`, `blockerBit`, `skinContactStatus`, `skinContactSupported`, `timeStamp`.

**Decisione.** LF/HF restano calcolati dall'app dai PPI (come Polar Flow e Kubios).

## 5. Distribuzione di errore PPI e `blocker`

**Perché.** Capire se lo scarto dipendeva dal segnale reale o dalla regola (soglia 10 ms, `blocker`).

**Come.** Riga diagnostica temporanea con il conteggio dei battiti della finestra per fasce di `errorEstimate` e `blocker`.

**Esito (finestra di 156 battiti, modalità client).**

| `errorEstimate` | Battiti |
|---|---|
| 0–10 ms | 60 |
| 11–20 ms | 77 |
| > 20 ms | 19 |

- `blocker=true` su 153/156 battiti, anche su quelli con errore basso. È il valore grezzo della SDK (`getBlockerBit()`), letto correttamente. In modalità client non scarta nulla.
- La soglia 10 ms scartava il 62% dei battiti.

**Decisione.** Barra di progresso verso il livello successivo (richiesta dell'utente). Ipotesi da verificare: soglia troppo stretta per il sensore ottico.

## 6. Sessione con barra di progresso

**Perché.** "Molto difficile arrivare a qualità media".

**Esito.**

| Tempo | Battiti buoni | Buco max | LF | HF |
|---|---|---|---|---|
| 1:00 | 63% | 3.8 s | 768 | 151 |
| 1:30 | 68% | 3.8 s | 356 | 143 |
| 2:00 | 56% | 9.1 s | 276 | 140 |
| 4:00 | 49% | 9.2 s | 291 | 64 |
| 5:10 | 34% | 16.6 s | 250 | 40 |

- Battiti con errore > 30 ms passati da 1 a 62 nella finestra durante la sessione. In questa sessione `blocker` era acceso solo su 12/65 battiti all'inizio.
- HF scende mentre i battiti sostituiti aumentano: la retta tra due battiti buoni appiattisce le oscillazioni veloci.
- La "Durata finestra" si ferma a ~5:09: finestra mobile trattenuta a 310–360 s di battiti (comportamento previsto).

**Decisione.** Livelli Bassa/Media/Ottima in UI, vibrazione 1/2/3 impulsi alla salita, bias da interpolazione documentato.

## 7. Confronto con H10, sessione 1 (17:57–18:06)

**Perché.** Il calcolo era corretto, ma non si sapeva se i valori del 360 fossero vicini al vero.

**Come.**
- H10 registrata con Polar Sensor Logger (file `_RR`, orario del telefono); 360 in questa app con copia di ogni PPI (orario, valore, errore, `blocker`) nel logcat.
- Stessi ultimi 300 s, stessa funzione `computeLfHfFromIntervals` per entrambe le serie; per il 360 variata solo la soglia di `errorEstimate`.
- Battiti abbinati per orario (±300 ms) dopo stima dello sfasamento tra i due telefoni (+5 s, correlazione 0.33): 442/561 abbinati.

**Esito LF/HF.**

| Sorgente | LF (ms²) | HF (ms²) | LF/HF | Battiti buoni |
|---|---|---|---|---|
| H10 ECG | 2994 | 689 | 4.35 | 100% |
| 360 ≤ 10 ms | 251 (−92%) | 29 (−96%) | 8.68 | 28% |
| 360 ≤ 15 ms | 956 (−68%) | 198 (−71%) | 4.83 | 55% |
| 360 ≤ 20 ms | 3530 (+18%) | 696 (+1%) | 5.08 | 79% |
| 360 ≤ 25–30 ms | 4559 (+52%) | 783 (+14%) | 5.82 | 86% |

**Esito per battito (differenza dal battito ECG corrispondente).**

| `errorEstimate` | Media | Mediana |
|---|---|---|
| 0–10 ms | 36–44 ms | 21–30 ms |
| 11–15 ms | 60 ms | 40 ms |
| 16–20 ms | 98 ms | 81 ms |
| 21–30 ms | 168 ms | 156 ms |
| > 30 ms | 351 ms | 342 ms |

L'abbinamento è approssimativo (il 360 consegna i PPI a gruppi, orari ricostruiti): le differenze per battito sono un limite superiore.

**Decisione (scelta dell'utente).** `LF_HF_PPI_ERROR_ESTIMATE_MAX_MS = 20` in `services/ppi-sample-window.ts`, solo per LF/HF. Il RMSSD resta a 10 ms (`PPI_ERROR_ESTIMATE_SANE_MS`), non validato contro ECG.

## 8. Confronto valori live vs H10, sessione 2 (18:19–18:26)

**Perché.** Con la soglia 20 ms in app "sono tornati valori alti": verificare che fossero giusti.

**Come.** Valori `HRV_PSD` mostrati dall'app confrontati con H10 calcolato sulla stessa finestra temporale. Battiti buoni 80–93%, qualità Media da 2:00, HR medio 62 bpm.

**Esito.**

| Ora | Finestra | 360 LF / HF / LF/HF | H10 LF / HF / LF/HF | Differenza |
|---|---|---|---|---|
| 18:21:19 | 2:06 | 2215 / 725 / 3.05 | 3728 / 551 / 6.77 | LF −41%, HF +32% |
| 18:22:52 | 3:39 | 3134 / 610 / 5.14 | 2708 / 406 / 6.67 | LF +16%, HF +50% |
| 18:24:30 | 5:09 | 3813 / 525 / 7.26 | 2653 / 343 / 7.74 | LF +44%, HF +53%, LF/HF −6% |
| 18:25:31 | 5:10 | 3504 / 544 / 6.44 | 2585 / 465 / 5.56 | LF +36%, HF +17%, LF/HF +16% |
| 18:26:04 | 5:09 | 3309 / 612 / 5.40 | 2643 / 548 / 4.82 | LF +25%, HF +12%, LF/HF +12% |

Valori dell'ordine giusto; a finestra piena LF/HF entro ±16%. Prima dei 5 minuti forti oscillazioni.

## 9. Esperimento di pesatura e prova su sessione 3

**Perché.** Ridurre lo scarto dall'ECG pesando i battiti in base all'errore PPI invece di accettarli o scartarli.

**Come.**
- Finestre di 300 s ogni 30 s, H10 come riferimento sulla stessa finestra temporale.
- Punteggio = somma degli scarti mediani in valore assoluto (in scala logaritmica) di LF, HF e LF/HF; più basso è meglio.
- Metodi scelti sulle sessioni 1–2; la sessione 3 (18:34–18:43, 94% dei battiti con errore ≤ 20 ms) registrata dopo la scelta e usata come prova indipendente.

**Esito.**

| Metodo | Sessioni 1–2 | Sessione 3 |
|---|---|---|
| Attuale (errore ≤ 20 ms accettato, altrimenti sostituito) | 0.67 | 0.95 |
| Togli picchi (> 150 ms dalla mediana dei vicini, errore > 10 ms) + soglia 25 ms | 0.59 | 0.94 |
| Peso continuo verso la retta tra i vicini (k = 25 ms) | 0.92 | 0.91 |
| Peso lineare 10→20 ms | 1.01 | — |
| Sottrazione rumore stimato (fattore 1) | 0.75 | 0.86 |
| Sottrazione rumore stimato (fattore 2–3) | 1.34–9.25 | 0.95–4.21 |

- Pesare verso la retta sottostima HF (fino a −48%): la retta è un filtro passa-basso.
- Nessuna variante batte la regola attuale in modo consistente su tutte e tre le sessioni.

**Scarto della regola attuale per sessione (mediana delle finestre).**

| Sessione | LF | HF | LF/HF |
|---|---|---|---|
| 1 (17:57) | −17% | +35% | −19% |
| 2 (18:19) | +41% | +26% | +12% |
| 3 (18:34) | −32% | +3% | −37% |

**Decisione.** Nessuna modifica. Lo scarto cambia segno tra sessioni: non è una sovrastima fissa correggibile con un fattore.

## Conclusioni

- Il **calcolo** di LF/HF è corretto e verificabile (test 1).
- La soglia 10 ms rendeva LF/HF del 360 circa 10 volte troppo bassi; con **20 ms** sono dell'ordine dell'ECG (test 7–8).
- Margine realistico del 360 rispetto a un ECG: circa **±35%** su LF, HF e LF/HF, anche con segnale buono, con segno variabile (test 9). È un limite del sensore ottico al polso (rumore, ritardo variabile dell'onda di polso), non del codice. Costante UI: `LF_HF_VS_ECG_TYPICAL_ERROR_PCT` in `services/ppi-sample-window.ts`.
- Uso consigliato: tendenze e confronti nella stessa persona con qualità almeno Media. Per valori assoluti confrontabili con un ECG usare la fascia H10.
- In app (360/Loop) sotto LF/HF: nota esplicita che i valori sono **stimati dai PPI**, non letti dal dispositivo, e scarto tipico ±35% vs H10.

## Limiti e punti aperti

- Tre sessioni, un solo soggetto, sempre a riposo da seduti.
- RMSSD (soglia 10 ms) non confrontato con l'ECG.
- Abbinamento battito per battito approssimativo (orari 360 ricostruiti, sfasamento tra telefoni stimato).
- Bias noto dell'interpolazione lineare su HF a frequenza cardiaca bassa, non corretto.
- La vibrazione non ha isteresi: con battiti buoni intorno al 60% può vibrare più volte.
- Il confronto con Kubios (spline cubica, detrend smoothness priors, Welch) non è stato fatto: valori simili ma non identici.

## Come ripetere un confronto con H10

1. Indossare H10 e 360 insieme; registrare H10 con Polar Sensor Logger (stream HR con RR).
2. Avviare lo streaming del 360 in questa app, restare fermi 8–10 minuti, fermare 360 e poi H10.
3. Serie 360: usare `ppiSamples` dal payload Ably (per battito `timestamp`, `ppiMs`, `errorEstimate`, `blocker`, `kind`). La riga diagnostica di logcat usata il 21/10 è stata rimossa.
4. Calcolare LF/HF di entrambe le serie con `computeLfHfFromIntervals` (o lo snippet Python in [Verifica LF/HF](polar-360-connection-guide.md#verifica-lfhf-esterna)) sulle stesse finestre temporali di 300 s.
5. Aggiungere i risultati a questo registro.
