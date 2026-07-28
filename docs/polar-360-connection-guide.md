# Guida al Collegamento del Polar 360 con l'app Augmented Monitor

Allineata alla documentazione ufficiale Polar BLE SDK
([Polar360.md](https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/products/Polar360.md),
[FirstTimeUse.md](https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/FirstTimeUse.md)).

## Dispositivi compatibili

Al momento l'unico dispositivo supportato è il **Polar 360**.

## Requisiti preliminari

- Dispositivo Polar 360 carico.
- **Smartphone Android 13 o superiore** (API 33+): versioni precedenti non consentono l'installazione dell'app.
- Bluetooth attivo.
- App Augmented Monitor installata (versione corrente: **1.0.0**).
- Connessione Internet stabile (per autenticazione Become / Ably).
- Consenso ai permessi richiesti: Bluetooth, notifiche (per lo streaming a schermo spento).
- **Non** usare Polar Flow durante il collegamento con Augmented Monitor (chiudere Flow se aperta).
- **Non** abbinare il Polar dalle Impostazioni Bluetooth di sistema: il pairing va fatto dall'app SDK.

## 1. Prima accensione del Polar 360

1. Collega il Polar 360 al cavo di ricarica per alcuni minuti.
2. Quando i LED rossi iniziano a ruotare, significa che il dispositivo è acceso.
3. Indossa il Polar 360 sul polso, preferibilmente a contatto diretto con la pelle.

Se i LED mostrano l'animazione di "Waiting for First time use", è normale: Augmented Monitor esegue automaticamente il First Time Use (`doFirstTimeUse`) al primo collegamento.

## 2. Collegamento del Polar 360 all'app Augmented Monitor

1. Assicurati di essere entro **1 metro** dal telefono (il Polar 360 verifica la prossimità in pairing).
2. Apri l'app Augmented Monitor.
3. Consenti all'app i permessi Bluetooth e, se richiesto, le **notifiche**.
4. Clicca su **"Collega Polar 360"** / **"Cerca Dispositivo Polar"** per avviare la scansione.
5. Al primo collegamento l'app:
   - completa il pairing BLE
   - esegue il **First Time Use** (configurazione dispositivo via SDK) e, se necessario, **riavvia** il Polar
   - alla riconnessione avvia lo streaming HR / PPI verso la piattaforma Become
   - avvia un **servizio in primo piano** con notifica persistente (dispositivo collegato + HR, HRV, LF, HF aggiornati in tempo reale), così lo streaming continua anche a schermo bloccato

### Se il dispositivo non viene trovato

1. Attendi 30 secondi durante la ricerca.
2. Se non appare alcun dispositivo:
   - Disattiva manualmente il Bluetooth dalle impostazioni di sistema.
   - Riattivalo dopo qualche secondo.
   - Ripeti la ricerca nell'app Augmented Monitor.
3. Se il Polar era già abbinato a un altro telefono o a Polar Flow:
   - esegui un **factory reset** (pulsante nascosto sotto il cinturino mentre è in carica, oppure via SDK)
   - su Android, rimuovi eventuali pairing residui dalle impostazioni Bluetooth
   - ripeti la ricerca (il Polar 360 è **1 peer only**: dopo il pairing è invisibile agli altri dispositivi)

## 3. Autenticazione e abbinamento con la piattaforma Become

1. Al primo login su Augmented Monitor verrà richiesto di inserire i 4 codici di connessione.
2. Accedi alla platform web di Become → sezione **/devices**.
3. Aggiungi un nuovo dispositivo Polar 360 e abbinalo al visore.
4. Inserisci i 4 codici visualizzati sull'app.

Una volta completata l'associazione, sull'app Augmented Monitor apparirà un popup verde che conferma la connessione tra app e piattaforma.

### Login una tantum

- L'inserimento dei 4 codici di accesso avviene solo la prima volta.
- Dopo la connessione iniziale, l'app Augmented Monitor riconoscerà automaticamente il dispositivo alle connessioni successive.
- Il First Time Use sul Polar viene eseguito solo se non è già stato completato (`isFtuDone`).
- Dopo un FTU appena eseguito il Polar **si riavvia**; i LED smettono l'animazione "Waiting for First time use" solo dopo quel riavvio. L'app riparte con scan/riconnessione automatica e poi lo streaming.
- FTU (`waitForFtuFeatures` / `performFirstTimeUse` / `restartDevice`), reconnect e PPI sono **building block condivisi** (Polar 360 e Loop Gen 2), orchestrati da `ensureFirstTimeUse` + riconnessione.

## 4. Stato della connessione

Quando tutti i LED diventano verdi, significa che:

- La connessione tra app e dispositivo è attiva.
- Lo streaming dei dati biometrici dal Polar 360 alla piattaforma è in corso.

**Importante:** durante tutta la procedura, il Polar 360 deve essere indossato.

Durante lo streaming, la barra delle notifiche mostra il nome del Polar collegato e i quattro valori trasmessi (`HR · HRV · LF · HF`). Non chiudere/rimuovere quella notifica: indica che il monitor resta attivo in background.

## Disconnessione del dispositivo

- Il tasto **"Disconnetti dispositivo Polar 360"** nell'app Augmented Monitor interrompe lo stream di dati in modo forzato.
- La disconnessione non rimuove l'abbinamento BLE né lo stato FTU.
- Se, dopo aver cliccato su **"Cerca Polar 360"**, il dispositivo non si ricollega automaticamente:
  - Spegni e riaccendi manualmente il Bluetooth.
  - Riavvia la ricerca del dispositivo nell'app Augmented Monitor.

## Risoluzione dei problemi

Se il Polar 360 non si collega correttamente:

1. Chiudi Polar Flow completamente.
2. Spegni e riaccendi manualmente il Bluetooth del telefono.
3. Se resta invisibile o il First Time Use fallisce: factory reset + forget device + riprova entro 1 m.

L'app Augmented Monitor non può riavviare il Bluetooth automaticamente per motivi di sicurezza imposti da Android.

## Collegamento completato

Il Polar 360 è associato a Augmented Monitor e sta trasmettendo in tempo reale i dati biometrici alla piattaforma.
