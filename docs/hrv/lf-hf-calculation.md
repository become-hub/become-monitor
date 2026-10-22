# Calcolo di LF e HF in dettaglio

Spiegazione passo per passo di come l'app trasforma i battiti (PPI del Polar 360/Loop o RR del Polar H10) in **LF**, **HF** e **LF/HF**. Vale `algoVersion = hrv-1`.

Codice: `features/hrv/core/hrv-calculator.ts` (spettro) e `features/hrv/ppi/ppi-sample-window.ts` (finestra e classificazione dei battiti). Accuratezza misurata contro l'H10: [../lf-hf-accuracy-vs-h10.md](../lf-hf-accuracy-vs-h10.md). Riepilogo dell'algoritmo: [algorithm.md](./algorithm.md).

## In breve

```
battiti SDK → classificazione → asse tempo X → correzione salti (Y)
  → ricampionamento 4 Hz → sottrazione media → finestra Hann
  → zero-padding (potenza di 2) → FFT → PSD one-sided
  → LF = ∫ PSD su [0,04; 0,15) Hz    HF = ∫ PSD su [0,15; 0,40] Hz
  → LF/HF = LF / HF
```

Ogni risultato è in **ms²**. Il rapporto non ha unità.

## 1. Input: la finestra di battiti

- **360 / Loop:** ogni battito è un `PolarPpiSample` della SDK con `ppi` (ms), `errorEstimate` (ms) e `blocker` (flag movimento/contatto). I campioni arrivano a gruppi (frame); LF/HF si ricalcola una volta per frame.
- **H10:** RR dell'ECG dalla notifica BLE standard; nessun `errorEstimate`.
- **Finestra rolling:** si tengono almeno 310 s di battiti (retention minima) e fino a 360 s se il dominio ricampionato è ancora < 300 s (`PPI_RAW_RETENTION_MIN_MS` / `MAX_MS`).
- LF/HF non si ricalcolano dai valori a 1 Hz della UI: solo dai campioni SDK.

## 2. Classificazione di ogni battito

Per ogni PPI (`classifyPpiRejectReason`), in ordine:

| Condizione | `kind` | Effetto |
|---|---|---|
| PPI < 300 ms o > 2000 ms | `out_of_physiological_range` | escluso dall'asse tempo e dal tachogramma; non fa avanzare l'orologio |
| `errorEstimate` > **20 ms** | `quality_rejected` | resta sull'asse tempo; il valore viene sostituito per interpolazione |
| `blocker = true` in modalità Estesa | `quality_rejected` | come sopra |
| altrimenti | `accepted` | usato così com'è |

Nota: la soglia 20 ms vale per LF/HF. Per RMSSD la soglia è 10 ms. Con 10 ms il 360 perdeva ~72% dei battiti e LF/HF risultavano ~10 volte troppo bassi rispetto all'H10 (registro validazione, test 7).

In modalità Live (`client`) `blocker` non scarta nulla: serve solo per l'avviso movimento (vedi §9).

## 3. Asse tempo X e valori Y

- **X (tempo):** somma cumulativa dei PPI **grezzi** inclusi (`accepted` + `quality_rejected`). Il primo battito è a t = 0.
- **Y (valore):** il PPI dopo la correzione del §4.
- X non viene mai ricostruito dai valori corretti. Così l'asse resta ancorato al tempo reale dei battiti anche quando se ne sostituiscono alcuni.

## 4. Correzione dei battiti non affidabili

1. **Ancore:** battiti `accepted` la cui differenza dall'ultima ancora è < **200 ms** (`MAX_SUCCESSIVE_DIFF_MS`). Servono almeno 2 ancore.
2. **Sostituzione:** ogni battito che non è un'ancora (scartato per qualità o con salto ≥ 200 ms) riceve un valore **interpolato linearmente per indice** tra l'ancora precedente e la successiva. Prima della prima ancora e dopo l'ultima si ripete il valore dell'ancora più vicina.
3. **Buco di artefatti:** i battiti sostituiti consecutivi formano un «buco»; `maxArtifactGapSec` è la durata (somma dei PPI) del buco più lungo. Serve per lo stato di qualità (§8).

Effetto noto: una retta tra due battiti buoni **appiattisce** le oscillazioni veloci. Più battiti vengono sostituiti, più HF è sottostimato (e LF/HF tende a salire).

## 5. Ricampionamento a 4 Hz

Il tachogramma `(X, Y)` è irregolare (un punto per battito). Per fare una FFT serve una griglia uniforme:

- frequenza di campionamento `fs = 4 Hz`, passo 0,25 s;
- punti `n = floor(durata × 4) + 1`, con durata = `X_ultimo − X_primo`;
- interpolazione **lineare** nel tempo, **senza estrapolare** oltre il primo e l'ultimo battito.

Esempio: 300 s → 1201 punti.

## 6. Spettro di potenza (`computeOneSidedPsd`)

1. **Sottrazione della media** della serie ricampionata (nessun detrend lineare).
2. **Finestra di Hann** `w[i] = 0,5·(1 − cos(2πi/(n−1)))` per ridurre le fughe spettrali.
3. **Zero-padding** fino alla prima potenza di 2 ≥ n (1201 → 2048). Il padding interpola lo spettro, non migliora la risoluzione reale (≈ 1/durata ≈ 0,0033 Hz per 300 s, allargata dalla finestra di Hann).
4. **FFT** (libreria `fft.js`).
5. **PSD one-sided:** per ogni bin `k`

   \[
   P_k = \frac{|X_k|^2}{f_s \cdot \sum w_i^2}
   \]

   e raddoppio per i bin tra 1 e N/2−1 (potenza dei bin negativi).
6. Passo in frequenza `df = fs / fftSize` (per 2048: 0,00195 Hz).

È un **periodogramma singolo** (non Welch, nessuna media tra segmenti): varianza alta su finestre corte. Questo spiega perché con 120 s l'errore è molto più instabile che con 300 s.

## 7. LF, HF e rapporto

Integrazione per somma sui bin (`potenza × df`):

| Banda | Intervallo | Note |
|---|---|---|
| **LF** | 0,04 ≤ f < 0,15 Hz | 0,15 Hz conta solo in HF |
| **HF** | 0,15 ≤ f ≤ 0,40 Hz | estremo incluso |

\[
\text{LF} = \sum_{0{,}04\le f<0{,}15} P_k\,\Delta f \qquad
\text{HF} = \sum_{0{,}15\le f\le 0{,}40} P_k\,\Delta f \qquad
\text{LF/HF} = \frac{\text{LF}}{\text{HF}}\ \ (\text{se HF} > 0)
\]

Unità: ms². Vengono anche calcolati i picchi di frequenza (LF, HF e 0,04–0,40 Hz) per diagnostica.

Pubblicazione: l'app arrotonda LF e HF all'intero e il rapporto a 3 decimali. LF/HF compaiono solo dopo che RMSSD è pronto (Live: 30 battiti; Estesa: epoch), per evitare lo spettro instabile dei primi secondi.

## 8. Stato di qualità (`lfHfStatus`)

| Stato | Condizione |
|---|---|
| `unavailable` | nessuno spettro (pochi battiti, meno di 2 ancore) |
| `warming_up` | gate live ok, ma ricampionato < 120 s |
| `low_quality` | battiti buoni < 60% **oppure** buco > 10 s **oppure** motion gate (§9) |
| `provisional` | ≥ 120 s, battiti buoni ≥ 60%, buco ≤ 10 s |
| `valid` | ≥ 300 s, ≥ 150 battiti buoni, battiti buoni ≥ 75%, buco ≤ 5 s |

Le potenze vengono comunque pubblicate (tranne `unavailable`): lo stato indica quanta fiducia dargli, non se mostrarle. In app: Bassa (`warming_up`, `low_quality`), Media (`provisional`), Ottima (`valid`).

## 9. Motion gate (solo stato)

Se negli ultimi 120 s di finestra almeno il **95%** dei battiti ha `blocker = true` (con almeno 20 battiti), lo stato diventa `low_quality` e `lfHfValid` false. **LF, HF e rapporto non cambiano**, quindi `hrv-1` resta riproducibile. La regola vale in Live ed Estesa; il replay offline la applica perché `blocker` è nella tupla del beat. Motivazione e dati: [../lf-hf-validation-log.md](../lf-hf-validation-log.md) (test 11).

## 10. Cosa limita la precisione

Misurato contro l'H10 (stesso algoritmo applicato a entrambe le serie, quindi la differenza viene dal segnale):

- **PPG vs ECG:** il tempo di transito dell'onda di polso al polso varia battito per battito; questo jitter aggiunge potenza soprattutto in HF. A riposo l'errore sul rapporto è tipicamente 8–21%, segno variabile.
- **Movimento:** il PPG degrada e LF/HF si scostano del 45–255%. `errorEstimate` non lo rileva; `blocker` sì, ma non in tutti i tipi di movimento.
- **Interpolazione lineare:** abbassa HF quando molti battiti sono sostituiti.
- **Periodogramma singolo:** varianza alta sotto ~5 minuti.
- **Buco di 10 s nel primo minuto:** può tenere lo stato `low_quality` fino a ~5,5 minuti, perché il buco resta nella finestra di 310 s.

Numeri e protocollo: [../lf-hf-accuracy-vs-h10.md](../lf-hf-accuracy-vs-h10.md).

## 11. Costanti (`hrv-1`)

| Costante | Valore | Dove |
|---|---|---|
| Intervallo PPI utilizzabile | 300–2000 ms | `ppi-limits.ts` |
| Soglia `errorEstimate` LF/HF | 20 ms | `LF_HF_PPI_ERROR_ESTIMATE_MAX_MS` |
| Soglia salto successivo | 200 ms | `MAX_SUCCESSIVE_DIFF_MS` |
| Campionamento | 4 Hz | `DEFAULT_HRV_SAMPLING_HZ` |
| LF / HF | [0,04; 0,15) / [0,15; 0,40] Hz | `LF_BAND_HZ` / `HF_BAND_HZ` |
| Dominio minimo `valid` | 300 s | `MIN_RESAMPLED_DURATION_SEC` |
| Battiti buoni minimi `valid` | 150 | `MIN_ACCEPTED_PPI` |
| Rapporto battiti buoni (`valid` / `provisional`) | 75% / 60% | `MIN_ACCEPTED_RATIO` / `PROVISIONAL_MIN_ACCEPTED_RATIO` |
| Buco massimo (`valid` / `provisional`) | 5 s / 10 s | `MAX_ARTIFACT_GAP_SEC` / `PROVISIONAL_MAX_ARTIFACT_GAP_SEC` |
| Warm-up | 120 s | `PROVISIONAL_MIN_SEC` |
| Retention finestra | 310–360 s | `ppi-sample-window.ts` |
| Motion gate | 95% `blocker` su 120 s, ≥ 20 battiti | `ppi-sample-window.ts` |

## 12. Verifica indipendente

Il calcolo è stato verificato con test unitari: DFT diretta indipendente (scarto < 1e-9) e ampiezza teorica di una sinusoide (entro il 3%). Dalle sessioni live, il replay offline dei battiti del 360 coincide con i valori pubblicati. Vedi [../lf-hf-validation-log.md](../lf-hf-validation-log.md), test 1 e 10, e [../polar-360-connection-guide.md](../polar-360-connection-guide.md#verifica-lfhf-esterna).
