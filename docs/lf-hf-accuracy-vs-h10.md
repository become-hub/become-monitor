# Accuratezza LF/HF del Polar 360 rispetto al Polar H10

Sintesi dell'errore di LF/HF calcolati dai PPI del Polar 360 (PPG al polso) rispetto agli stessi indici calcolati dagli RR del Polar H10 (ECG al torace). **Il confronto con l'H10 è stato fatto** in 8 registrazioni del 22/10/2026 con i due dispositivi indossati insieme e collegati allo **stesso telefono** (stesso orologio, nessun allineamento tra dispositivi da stimare).

Dettaglio dei test, metodo e decisioni: [lf-hf-validation-log.md](./lf-hf-validation-log.md). Come viene calcolato LF/HF: [hrv/lf-hf-calculation.md](./hrv/lf-hf-calculation.md).

## Risposta breve

| Condizione | Errore sul rapporto LF/HF (mediana, finestra 300 s) | Affidabilità |
|---|---|---|
| **A riposo** (seduto, fermo) | **8–21%** in 5 sessioni su 6 (mediana delle sessioni: 16%); una sessione al 67% | Utilizzabile per tendenze nella stessa persona |
| **In movimento** (scrittura, gesti, braccio) | **45–255%** (scrittura 45–46%, gesti 77%, braccio 255%) | Non affidabile; l'app segnala qualità «Bassa» solo in parte dei casi |

Non c'è equivalenza con l'ECG: a riposo il 360 si avvicina all'H10, ma non lo sostituisce. Per valori assoluti confrontabili con un ECG usare la fascia H10.

## Come è stato fatto il confronto

- **Riferimento:** Polar H10, RR dall'ECG, registrati dal modulo nativo dell'app (card **Riferimento H10**, Developer Mode).
- **Misura:** Polar 360 al polso, PPI dalla SDK Polar, stessa registrazione e stesso orologio del telefono.
- **Calcolo:** per entrambe le serie la stessa funzione (`computeLfHfFromIntervals`), quindi la differenza è solo nel segnale, non nell'algoritmo.
- **Finestre:** 300 s scorrevoli (passo 15–30 s); anche 120 s per vedere l'effetto della durata.
- **Errore:** \(|\text{LF/HF}_{360} - \text{LF/HF}_{H10}| / \text{LF/HF}_{H10}\), mediana delle finestre della fase.
- **Dati scartati dal riferimento:** RR anomali dell'H10 (nella sessione E un buco di 8,1 s dovuto alla fascia).
- **Un solo soggetto**, sempre seduto. Otto sessioni non sono un campione clinico.

## Errore a riposo

Finestre di 300 s. Errore sul rapporto LF/HF.

| Sessione | Fase a riposo | Errore mediano |
|---|---|---|
| B | 10 min a riposo, rumore HF alto sul 360 | **67%** |
| C | 5 min a riposo | 11% |
| D | 7 min a riposo | 18% |
| E | ~6 min a riposo | 21% |
| F | 6 min a riposo | 14% |
| G | ~6 min a riposo | 8% (360 5,8 vs H10 5,5) |

- Intervallo delle sessioni «normali» (C–G): **8–21%**, massimo di singola finestra 26%.
- La **sessione B** (67%) mostra che il rumore del sensore può essere molto più alto in una sessione: la soglia dichiarata in UI (±35%) non copre quel caso.
- **Segno dell'errore non costante.** Nelle sessioni C–F il rapporto del 360 è prevalentemente più basso dell'H10 (circa −15/−20%: il jitter del tempo di transito dell'onda di polso aumenta la potenza HF); nella sessione G è più alto (+6%). Non c'è un bias fisso da correggere.
- Con finestre di **120 s** l'errore è molto più alto e instabile (mediana 23%, massimo 83% nella sessione G). Il valore è utilizzabile solo con ~5 minuti di dati.

## Errore in movimento

| Sessione | Movimento | Errore mediano (300 s) | Note |
|---|---|---|---|
| D | movimento del braccio (3 min) | **255%** | salti nei PPI gonfiano LF |
| E | scrittura al PC (4 min) | **46%** | HF sovrastimato |
| F | scrittura al PC (4 min) | **45%** | HF sovrastimato |
| G | gesti moderati (4 min) | **77%** | H10 13,4 vs 360 2,7 |

- Il movimento cambia anche la **fisiologia** (nella sessione G la frequenza cardiaca H10 passa da 59 a 82 bpm e LF/HF dell'H10 sale fino a 27): il polso non segue questo cambiamento.
- `errorEstimate` (la stima d'errore della SDK) **non lo segnala**: resta a 8–13 ms. Stringere la soglia non corregge il movimento e a riposo scarta troppi battiti.

## Come l'app segnala il movimento

Regola (solo stato, i numeri non cambiano): se negli ultimi 120 s almeno il 95% dei battiti ha `blocker=true` (SDK Polar), lo stato LF/HF diventa `low_quality` (in app: qualità **Bassa**).

| Fase | Tempo sopra soglia |
|---|---|
| A riposo (sessioni C, D, F, G) | 0–1% |
| Scrittura (F) | 67% |
| Gesti (G) | 61% |
| Movimento del braccio (D) | **0%** (non rilevato) |

Verifica dal vivo (sessione H, 23:39): a riposo la regola non è scattata; dal minuto 8 con il movimento il `blocker` è arrivato a 0,96–1,00 e lo stato è passato a `low_quality`. In quella sessione lo scarto dall'H10 (finestre di 120 s, quindi solo indicativo) è passato da circa 10% a 24%, 42% e 60% mentre la regola scattava.

## Limiti

- Un soggetto, sempre seduto; nessun test con respiro guidato né camminata.
- Il movimento del braccio (sessione D) non è rilevato dalla regola: servirebbe l'accelerometro, che l'app oggi non acquisisce.
- A riposo lo stato può restare «Bassa» per ~5,5 minuti se nel primo minuto i battiti corretti formano un buco di poco superiore a 10 s (osservato nella sessione H, 10,2 s): non è un errore del 360, è la soglia del buco massimo.
- Nessun confronto con Kubios (spline cubica, detrend smoothness priors, Welch): valori simili, non identici.

## Uso consigliato

- **Sì:** tendenze e confronti nella stessa persona a riposo, con qualità almeno **Media**, su finestre di ~5 min.
- **No:** valori assoluti confrontati con un ECG, finestre brevi, periodi con movimento del polso, qualità **Bassa**.
