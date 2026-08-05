# Guida al Collegamento Muse 2 con Augmented Monitor

> **Attualmente disabilitato in app.** Muse 2 resta nel codice (catalogo, `MuseBleModule`, setup/streaming) ma connect / pair / UI / docs in-app sono spenti via [`constants/device-availability.ts`](../constants/device-availability.ts) (`muse_2: false`). Per riattivare: impostare `muse_2: true`.

Integrazione **BLE diretta** (GATT Android nativo), senza SDK Interaxon ufficiale e **senza** Mind Monitor / OSC.

## Dispositivo compatibile

- **Muse 2** (headset EEG Interaxon)

Stack isolato da Polar (`MuseBleModule` + `muse-*` JS). Un solo device alla volta: Muse **oppure** Polar.

## Requisiti preliminari

- Muse 2 carico e acceso (LED / pairing mode secondo il manuale headset).
- **Smartphone Android 13 o superiore** (API 33+).
- Bluetooth attivo.
- App Augmented Monitor installata (versione corrente: **1.2.0**).
- Connessione Internet stabile (autenticazione Become / Ably live).
- Consenso ai permessi: Bluetooth, notifiche (streaming a schermo spento).
- **Non** è richiesto Mind Monitor, OSC, né Polar Flow.
- Preferibile non tenere altre app collegate allo stesso Muse durante lo scan.

## Segnali usati in app

| Segnale | Dettaglio |
| --- | --- |
| EEG 4 canali | TP9, AF7, AF8, TP10 (~256 Hz sul protocollo; UI throttled) |
| Bande relative | Delta, Theta, Alpha, Beta, Gamma (stima su finestra EEG) |
| HR | Derivato da PPG fronte (stream IR/red); mostrato in Monitor |
| Batteria | Telemetria Muse quando disponibile |

Fuori scope MVP: accelerometro / giroscopio, offline recording Muse, iOS.

## 1. Preparazione headset

1. Accendi Muse 2 e indossalo con elettrodi a contatto (fronte + orecchie).
2. Resta vicino al telefono (entro ~1 m per lo scan iniziale).

## 2. Collegamento in Augmented Monitor

1. Apri l’app → tab **Monitor**.
2. Avvia la ricerca dispositivi (scan unificato Polar + Muse).
3. Nell’elenco, seleziona il **Muse 2** (badge famiglia Muse). L’app **non** si connette da sola al primo trovato.
4. Al collegamento l’app:
   - completa il pairing GATT sul service Muse (`0000fe8d-…`)
   - autentica Become sul **`deviceId`** BLE (stesso schema per-device delle sessioni Polar)
   - avvia streaming **EEG + bande** e **PPG → HR** (`startMuseStreaming`)
   - **non** esegue FTU Polar né offline PPI
5. In Monitor compaiono le card Muse: canali EEG, bande, HR (PPG), batteria.
6. Se Ably è connesso, l’hub riceve messaggi `heartRate` con `deviceFamily: "muse"`, `hr` e bande (`alpha`…`gamma`).

### Auth e reset token

- Il token Become è salvato per `deviceId` (come Polar).
- Dal menu del device connesso puoi **Reset auth token**: cancella la sessione di quel Muse e disconnette.

### Concorrenza

Di default è supportato **un solo device** alla volta. Per passare a Polar: disconnetti Muse, poi riesegui lo scan.

## Se Muse non viene trovato

1. Spegni e riaccendi Muse 2.
2. Chiudi altre app che usano Muse (es. Mind Monitor se aperta).
3. Toggle Bluetooth del telefono.
4. Ripeti lo scan entro 1 m; verifica che il nome BLE contenga `Muse`.

## Risoluzione problemi

| Sintomo | Cosa provare |
| --- | --- |
| Scan vuoto | Bluetooth on, Muse acceso, permessi BT concessi, Android 13+ |
| Connesso ma EEG a zero | Contatto elettrodi; riposiziona headset; riconnetti |
| HR assente / instabile | PPG fronte a contatto; resta fermo qualche secondo |
| Ably non riceve Muse | Auth ok sul deviceId; Hub online; verifica payload `deviceFamily: muse` |

L’app non può riavviare il Bluetooth di sistema automaticamente (limitazione Android).

## Collegamento completato

Muse 2 è associato ad Augmented Monitor e trasmette EEG / bande / HR verso la piattaforma Become senza passare da Mind Monitor.

Vedi anche il confronto Polar vs Muse nella tab **Documentazione** e in [polar-360-connection-guide.md](./polar-360-connection-guide.md) (tabella device/segnale).
