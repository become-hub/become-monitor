# Guida al Collegamento dei dispositivi Polar con Augmented Monitor

Allineata alla documentazione ufficiale Polar BLE SDK
([Polar360.md](https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/products/Polar360.md),
[FirstTimeUse.md](https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/FirstTimeUse.md)).

## Dispositivi compatibili

Dispositivi supportati:

- **Polar 360**
- **Polar Loop Gen 2**
- **Polar H10** (fascia petto ECG)

360 e Loop condividono lo stesso profilo SDK (PPG ottico, HR, PPI, ACC, skin temp, FTU). **H10** usa ECG a contatto: HR + RR nativi (`rrsMs`) ed ECG grezzo (µV) in streaming; **nessun FTU** e **nessun PPI offline**.

## Requisiti preliminari

- Polar 360, Loop Gen 2 o H10 carico / con batteria sufficiente.
- **Smartphone Android 13 o superiore** (API 33+): versioni precedenti non consentono l'installazione dell'app.
- Bluetooth attivo.
- App Augmented Monitor installata (versione corrente: **1.0.0**).
- Connessione Internet stabile (per autenticazione Become / Ably).
- Consenso ai permessi richiesti: Bluetooth, notifiche (per lo streaming a schermo spento).
- **Non** usare Polar Flow durante il collegamento con Augmented Monitor (chiudere Flow se aperta).
- **Non** abbinare il Polar dalle Impostazioni Bluetooth di sistema: il pairing va fatto dall'app SDK.

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
5. Quando compaiono i Polar supportati nell’elenco, **seleziona** quello che vuoi usare (360, Loop o H10). L’app **non** si connette automaticamente al primo trovato.
6. Al primo collegamento l'app:
   - completa il pairing BLE
   - **360 / Loop:** esegue il **First Time Use** (configurazione dispositivo via SDK) e, se necessario, **riavvia** il Polar
   - **H10:** salta FTU; avvia subito HR (con RR nativi) ed ECG grezzo
   - alla riconnessione **dello stesso** `deviceId` avvia lo streaming verso Become
   - **360 / Loop:** avvia **offline recording PPI** sul Polar (tracciato grezzo in memoria device); se fallisce, accumula un buffer live in-app
   - **H10:** solo buffer live in-app (`rrSource: ecg_rr`); niente offline PPI
   - calcola il tracciato **RR** (da PPI su 360/Loop, da `rrsMs` su H10, altrimenti `60000/HR` solo se non c’è grezzo)
   - avvia un **servizio in primo piano** con notifica persistente (dispositivo collegato + HR, HRV, LF, HF), così lo streaming continua anche a schermo bloccato

### Live vs flush a fine sessione (spike)

- **Live**: HR / PPI o RR ECG / HRV restano in streaming verso Ably (`heartRate`) per la visibilità in Hub.
- **Tracciato intero**: a fine sessione Hub pubblica su `private:{userId}` l’evento Ably **`endSession`** (payload opzionale `{ "sessionId": "..." }`). L’app:
  1. **360 / Loop:** ferma l’offline recording PPI, scarica il record dal Polar (o usa il buffer live)
  2. **H10:** usa solo il buffer live (RR `ecg_rr`)
  3. costruisce un payload grezzo `ppiTrack` (sample con `ppiMs`/`hr`, `rrMs`, `rrSource`)
  4. fa **POST** a `EXPO_PUBLIC_TRACK_UPLOAD_URL` con `Authorization: Bearer {authToken}`
  5. **360 / Loop:** rimuove il record offline dal device dopo upload ok
- Se `EXPO_PUBLIC_TRACK_UPLOAD_URL` è vuoto, lo spike fa **dry-run** (solo log).
- In Monitor, con **debug mode** attivo, è disponibile il bottone **“Simula endSession / Flush track”** per test senza Hub.

### Monitor — card grezze H10

Con H10 connesso, oltre a HR e metriche derivate (RMSSD, LF/HF), l’app mostra in evidenza:

- **RR (ECG)** — ultimo intervallo da `rrsMs` nativo (`ecg_rr`)
- **ECG** — ultimo campione in µV dallo streaming SDK

Su H10 **non** viene mostrato RR derivato da `60000/HR` quando è disponibile RR grezzo.

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

Fonte: profilo Polar BLE SDK condiviso da 360 e Loop Gen 2. Tabella allineata all’accordion in-app (tab Documentazione).

| Segnale / metrica | Polar 360 | Polar Loop Gen 2 | Polar H10 | Note scientifiche | Usato oggi in Augmented Monitor |
| --- | --- | --- | --- | --- | --- |
| Principio di sensing | PPG ottico (LED verde) | PPG ottico (stesso profilo SDK) | ECG a contatto (fascia toracica) | 360/Loop non sono ECG; H10 misura elettrica cardiaca | Sì |
| ECG | No | No | Sì (streaming SDK) | Segnale grezzo in microvolt (uV) | Sì (solo H10) |
| HR (BPM) | Sì (online) | Sì | Sì | Battiti/minuto da PPG (360/Loop) o ECG (H10) | Sì |
| PPI / PP interval | Sì (da PPG) | Sì | No | Intervallo pulse-to-pulse (ms), base HRV time-domain | Sì (360/Loop) |
| RR (ms) | Da PPI o `60000/HR` fallback | Idem | Nativo da `rrsMs` | `rrSource`: `ppi`, `ecg_rr`, `hr_derived` | Sì (live + flush) |
| HRV (RMSSD) | Derivata da RR/PPI | Derivata da RR/PPI | Derivata da RR ECG | Calcolo app, non metrica nativa device | Sì |
| LF / HF power | Derivata da finestra RR | Derivata da finestra RR | Derivata da finestra RR | Stima spettrale in-app su RR | Sì |
| PPG grezzo | Sì (SDK, es. ~22 Hz, 24 bit) | Stesso profilo SDK | No | Segnale AFE; richiede resampling | No in UI corrente |
| Accelerometro | Sì (es. ~50 Hz, +-8 g) | Sì | No | Movimento/activity | No in UI corrente |
| Temperatura cute | Sì (1-4 Hz) | Sì | No | Skin temperature | Sì (360/Loop) |
| FTU obbligatorio | Sì | Sì | No | FTU richiesto solo per famiglia 360/Loop | Sì (dove previsto) |

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

## Collegamento completato

Il Polar è associato a Augmented Monitor e sta trasmettendo in tempo reale i dati biometrici alla piattaforma.
