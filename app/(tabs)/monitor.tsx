/**
 * Monitor Tab
 * Migrazione del codice legacy per il monitoraggio cardiaco Polar
 */

import { AppFooter } from "@/components/app-footer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { API_BASE_URL } from "@/constants/constants";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { AblyService, ConnectionStatus } from "@/services/ably-service";
import { AuthService } from "@/services/auth-service";
import { calculateRMSSD, computeLfHf } from "@/services/hrv-calculator";
import {
  PolarDeviceInfo,
  PolarHrData,
  PolarPpiData,
  polarSdk,
} from "@/services/polar-ble-sdk";
import { StorageService, StoredAuthData } from "@/services/storage-service";
import { useScanStore } from "@/stores/scan-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUserStore } from "@/stores/user-store";
import {
  Activity,
  CheckCircle,
  Heart,
  Search,
  Trash2,
  Unplug,
  XCircle,
  Zap,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

// Dimensione finestra per HRV
const WINDOW_SIZE = 30; // ultimi 30 battiti (~30s)

// Timeout di scansione dispositivo
const SCAN_TIMEOUT = 30000; // 30 secondi

export default function MonitorScreen() {
  const { theme } = useTheme();

  // Scan store
  const {
    isScanning,
    setScanning,
    setDeviceFound,
    setScanStartTime,
    setConnectedDeviceId: setConnectedDeviceIdInStore,
    resetScanState,
  } = useScanStore();

  // User store
  const {
    userId,
    deviceCode,
    authToken,
    authCode,
    appId,
    setUserId,
    setDeviceCode,
    setAuthToken,
    setAuthCode,
    setAppId,
    resetUserState,
  } = useUserStore();

  // Settings store
  const { debugMode } = useSettingsStore();

  // Bluetooth & Polar
  const [bluetoothPowered, setBluetoothPowered] = useState(false);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(
    null
  );
  const [connectedDeviceName, setConnectedDeviceName] = useState<string>("");
  const [foundDeviceName, setFoundDeviceName] = useState<string>("");

  // Auth & Ably
  const authService = useRef(new AuthService());
  const ablyService = useRef<AblyService | null>(null);
  const userIdRef = useRef(0);

  const [ablyStatus, setAblyStatus] = useState<ConnectionStatus>(
    ConnectionStatus.DISCONNECTED
  );

  // Metriche cardiache
  const [heartRate, setHeartRate] = useState(0);
  const [hrv, setHrv] = useState(0);
  const [lfPower, setLfPower] = useState(0);
  const [hfPower, setHfPower] = useState(0);

  // Stato per la notifica di autenticazione
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Log ogni volta che userId cambia
  useEffect(() => {
    console.log(
      `Monitor: 🔍 userId changed to: ${userId} (type: ${typeof userId})`
    );
    userIdRef.current = userId;
  }, [userId]);

  // Mostra notifica di autenticazione quando il token è disponibile
  useEffect(() => {
    if (authToken) {
      setNotification({
        type: "success",
        message: "Autenticato con successo!",
      });

      // Auto-close dopo 5 secondi
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [authToken]);

  // Finestra PPI per calcolo HRV
  const ppiWindow = useRef<number[]>([]);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const biometricInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Inizializza Ably service
    ablyService.current = new AblyService(
      API_BASE_URL + "/services/ably",
      (status) => {
        setAblyStatus(status);
        console.log("Monitor: 🔵 Ably status:", status);
      }
    );

    // Controlla stato Bluetooth iniziale e prova a riconnettersi
    const initializeBluetooth = async () => {
      const powered = await polarSdk.checkBluetoothState();
      console.log(
        `Monitor: Stato Bluetooth iniziale: ${powered ? "ON" : "OFF"}`
      );
      setBluetoothPowered(powered);

      if (powered) {
        // Controlla se abbiamo dati di autenticazione salvati
        const storedAuthData = await StorageService.getAuthData();
        if (storedAuthData && storedAuthData.deviceId) {
          console.log(
            `Monitor: Tentativo riconnessione a ${
              storedAuthData.deviceName || storedAuthData.deviceId
            }`
          );
          // Prova a riconnettersi al dispositivo salvato usando l'ID
          try {
            await polarSdk.connectToDevice(storedAuthData.deviceId);
          } catch {
            console.log(
              "Monitor: Riconnessione diretta fallita, sarà necessario fare scansione"
            );
          }
        }
      }
    };

    initializeBluetooth();

    // Setup Polar SDK event listeners
    polarSdk.addEventListener("onBluetoothStateChanged", (state) => {
      console.log(`Monitor: Bluetooth ${state.powered ? "ON" : "OFF"}`);
      setBluetoothPowered(state.powered);

      // Invia stato Bluetooth ad Ably
      const userState = useUserStore.getState();
      if (ablyService.current && userState.authToken && userState.userId) {
        ablyService.current.sendMessage(
          userState.userId,
          "bluetooth_state_changed",
          {
            powered: state.powered,
            status: state.powered ? "ON" : "OFF",
          },
          userState.deviceCode
        );
      }

      // Se il Bluetooth si riaccende e non abbiamo un dispositivo connesso,
      // prova a riconnettersi al dispositivo salvato
      if (state.powered && !connectedDeviceId) {
        const tryReconnect = async () => {
          const storedAuthData = await StorageService.getAuthData();
          if (storedAuthData && storedAuthData.deviceId) {
            console.log(
              `Monitor: 🔄 Bluetooth riacceso, tentativo riconnessione a ${
                storedAuthData.deviceName || storedAuthData.deviceId
              }`
            );
            try {
              await polarSdk.connectToDevice(storedAuthData.deviceId);
            } catch {
              console.log(
                "Monitor: ⚠️ Riconnessione dopo riaccensione Bluetooth fallita"
              );
            }
          }
        };
        tryReconnect();
      }
    });

    polarSdk.addEventListener("onDeviceFound", (device: PolarDeviceInfo) => {
      console.log(`Monitor: 📡 Trovato: ${device.name} (${device.deviceId})`);

      // Marca che abbiamo trovato un dispositivo durante la scansione
      setDeviceFound(true);
      setFoundDeviceName(device.name);

      // Invia evento dispositivo trovato ad Ably
      const userStateFound = useUserStore.getState();
      if (
        ablyService.current &&
        userStateFound.authToken &&
        userStateFound.userId
      ) {
        ablyService.current.sendMessage(
          userStateFound.userId,
          "device_found",
          {
            deviceId: device.deviceId,
            deviceName: device.name,
            rssi: device.rssi,
          },
          userStateFound.deviceCode
        );
      }

      // Connetti automaticamente al primo Polar trovato
      polarSdk.stopScan();
      setScanningState(false);

      // Invia evento di scansione fermata per dispositivo trovato ad Ably
      const userStateStopped = useUserStore.getState();
      if (
        ablyService.current &&
        userStateStopped.userId &&
        userStateStopped.deviceCode
      ) {
        ablyService.current.sendMessage(
          userStateStopped.userId,
          "scan_stopped",
          {
            action: "scan_stopped",
            reason: "device_found",
            foundDevice: device.name,
          },
          userStateStopped.deviceCode
        );
      }

      polarSdk.connectToDevice(device.deviceId);
    });

    polarSdk.addEventListener(
      "onDeviceConnected",
      (device: PolarDeviceInfo) => {
        console.log(`Monitor: ✅ Connesso a ${device.name}!`);
        setConnectedDeviceId(device.deviceId);
        setConnectedDeviceIdInStore(device.deviceId);
        setConnectedDeviceName(device.name);
        setFoundDeviceName("");

        // Aggiorna il nome e l'ID del dispositivo nei dati salvati se esistono
        StorageService.updateDeviceName(device.name);
        StorageService.updateDeviceId(device.deviceId);

        // Invia evento di connessione ad Ably
        const userStateConnected = useUserStore.getState();
        if (
          ablyService.current &&
          userStateConnected.userId &&
          userStateConnected.deviceCode
        ) {
          ablyService.current.sendMessage(
            userStateConnected.userId,
            "device_connected",
            {
              deviceId: device.deviceId,
              deviceName: device.name,
              rssi: device.rssi,
            },
            userStateConnected.deviceCode
          );
        }

        // Avvia autenticazione e streaming
        launchAuthAndStream(device.deviceId);
      }
    );

    polarSdk.addEventListener(
      "onDeviceDisconnected",
      (device: PolarDeviceInfo) => {
        console.log("Monitor: ⚠️ Dispositivo disconnesso");

        // Mostra notifica di disconnessione
        setNotification({
          type: "error",
          message: `Dispositivo disconnesso`,
        });

        // Auto-close dopo 5 secondi
        setTimeout(() => {
          setNotification(null);
        }, 5000);

        // Invia evento di disconnessione ad Ably
        const userStateDisconnected = useUserStore.getState();
        if (
          ablyService.current &&
          userStateDisconnected.userId &&
          userStateDisconnected.deviceCode
        ) {
          ablyService.current.sendMessage(
            userStateDisconnected.userId,
            "device_disconnected",
            {
              deviceId: device.deviceId,
              deviceName: device.name,
              reason: "disconnected",
            },
            userStateDisconnected.deviceCode
          );
        }

        setConnectedDeviceId(null);
        setConnectedDeviceIdInStore(null);
        setConnectedDeviceName("");
        setFoundDeviceName("");
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
        stopBiometricSending();
        ablyService.current?.close();

        // Reset stato del dispositivo
        resetDeviceState();
      }
    );

    polarSdk.addEventListener("onHeartRateReceived", (data: PolarHrData) => {
      console.log(`Monitor: 💓 HR=${data.hr} BPM`);
      setHeartRate(data.hr);

      // Invia dati della frequenza cardiaca ad Ably (solo HR, HRV viene inviato separatamente quando calcolato)
      const userStateHR = useUserStore.getState();
      if (ablyService.current && userStateHR.userId && userStateHR.deviceCode) {
        ablyService.current.sendMessage(
          userStateHR.userId,
          "heart_rate",
          {
            deviceId: data.deviceId,
            heartRate: data.hr,
            contactDetected: data.contactDetected,
            contactSupported: data.contactSupported,
            ppiWindowSize: ppiWindow.current.length,
          },
          userStateHR.deviceCode
        );

        console.log(
          `Monitor: 📤 HEART RATE EVENT SENT - HR: ${data.hr}, PPI Window: ${ppiWindow.current.length}`
        );
      }

      // Se non ci sono dati PPI, calcola RR approssimato da BPM come fallback
      if (data.hr > 0) {
        const approximateRR = Math.round(60000 / data.hr);

        ppiWindow.current.push(approximateRR);
        if (ppiWindow.current.length > WINDOW_SIZE) {
          ppiWindow.current.shift();
        }

        // Calcola HRV quando la finestra è piena
        if (ppiWindow.current.length === WINDOW_SIZE) {
          const rmssd = calculateRMSSD(ppiWindow.current);
          setHrv(Math.round(rmssd));

          const { lf, hf } = computeLfHf(ppiWindow.current);
          setLfPower(Math.round(lf));
          setHfPower(Math.round(hf));

          console.log(
            `Monitor: 📊 HRV (da HR)=${Math.round(rmssd)}ms, LF=${Math.round(
              lf
            )}, HF=${Math.round(hf)}`
          );

          // Invia ad Ably
          const userStateHRFallback = useUserStore.getState();
          if (
            userStateHRFallback.authToken &&
            ablyStatus === ConnectionStatus.CONNECTED &&
            userStateHRFallback.userId &&
            userStateHRFallback.deviceCode
          ) {
            console.log(
              `Monitor: 🔍 Debug - userId: ${
                userStateHRFallback.userId
              } (type: ${typeof userStateHRFallback.userId}), userIdRef: ${
                userIdRef.current
              }, deviceCode: ${userStateHRFallback.deviceCode}`
            );
            console.log(
              `Monitor: 🔍 Current state - authToken: ${
                userStateHRFallback.authToken ? "present" : "missing"
              }, ablyStatus: ${ablyStatus}`
            );
            console.log(
              `Monitor: 🔍 Ably connection status: ${
                ablyStatus === ConnectionStatus.CONNECTED
                  ? "CONNECTED"
                  : "NOT CONNECTED"
              }`
            );
            ablyService.current?.sendHeartRate(
              userStateHRFallback.deviceCode,
              userStateHRFallback.userId,
              data.hr,
              Math.round(rmssd),
              Math.round(lf),
              Math.round(hf)
            );
          }
        }
      }
    });

    polarSdk.addEventListener("onPpiDataReceived", (data: PolarPpiData) => {
      console.log(
        `Monitor: 📊 PPI Data ricevuto - ${data.samples.length} samples`
      );

      // Invia dati PPI ad Ably
      const userStatePPI = useUserStore.getState();
      if (
        ablyService.current &&
        userStatePPI.userId &&
        userStatePPI.deviceCode
      ) {
        ablyService.current.sendMessage(
          userStatePPI.userId,
          "ppi_data",
          {
            deviceId: data.deviceId,
            samples: data.samples,
            sampleCount: data.samples.length,
          },
          userStatePPI.deviceCode
        );
      }

      handlePpiData(data);
    });

    polarSdk.addEventListener("onPpiStreamError", (error: any) => {
      console.log("Monitor: ⚠️ PPI Stream Error:", error.error);
      console.log("Monitor: 🔄 Modalità fallback attiva (HRV da HR)");

      // Invia errore PPI ad Ably
      const userStatePPIError = useUserStore.getState();
      if (
        ablyService.current &&
        userStatePPIError.userId &&
        userStatePPIError.deviceCode
      ) {
        ablyService.current.sendMessage(
          userStatePPIError.userId,
          "ppi_stream_error",
          {
            error: error.error,
            message: "PPI stream error occurred",
            fallbackMode: true,
          },
          userStatePPIError.deviceCode
        );
      }
    });

    return () => {
      polarSdk.stopScan();
      if (connectedDeviceId) {
        polarSdk.disconnectFromDevice(connectedDeviceId);
      }
      polarSdk.removeAllListeners();
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      stopBiometricSending();
      ablyService.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setScanningState = (value: boolean) => {
    setScanning(value);
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      try {
        console.log("Monitor: 🔐 Verifica stato permessi...");
        // Verifica se i permessi sono già concessi
        const hasPermissions = await polarSdk.hasBluetoothPermissions();
        console.log(`Monitor: 🔐 Permessi concessi: ${hasPermissions}`);

        if (!hasPermissions) {
          console.log("Monitor: 🔐 Permessi non concessi, richiedo...");

          // Richiedi permessi tramite il modulo nativo
          // NOTA: Questo mostrerà il dialog Android se non ci sono errori
          try {
            await polarSdk.requestBluetoothPermissions();
            console.log("Monitor: 🔐 Richiesta permessi inviata");

            // Aspetta un po' più tempo per far processare la richiesta
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const finalCheck = await polarSdk.hasBluetoothPermissions();
            console.log(`Monitor: 🔐 Verifica finale permessi: ${finalCheck}`);

            if (!finalCheck) {
              Alert.alert(
                "Permessi richiesti",
                "I permessi Bluetooth sono necessari per utilizzare l'app. Vai nelle impostazioni e concesse i permessi."
              );
              return false;
            }
          } catch (permissionError: any) {
            console.error(
              "Monitor: Errore nella richiesta permessi:",
              permissionError
            );
            Alert.alert(
              "Errore",
              "Impossibile richiedere i permessi: " + permissionError.message
            );
            return false;
          }
        } else {
          console.log("Monitor: ✅ Permessi già concessi");
        }

        return true;
      } catch (error: any) {
        console.error("Monitor: Errore richiesta permessi:", error);
        Alert.alert(
          "Errore",
          "Impossibile richiedere i permessi Bluetooth: " + error.message
        );
        return false;
      }
    }
    return true;
  };

  const startScan = async () => {
    console.log("Monitor: 🔍 startScan chiamato");

    // PRIMA richiedi i permessi (indipendentemente dallo stato Bluetooth)
    console.log("Monitor: 🔐 Controllo permessi...");
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log("Monitor: ❌ Permessi non concessi");
      return;
    }
    console.log("Monitor: ✅ Permessi concessi");

    // POI controlla lo stato Bluetooth
    const btState = await polarSdk.checkBluetoothState();
    console.log(`Monitor: Bluetooth stato: ${btState ? "ON" : "OFF"}`);

    if (!btState) {
      Alert.alert("Bluetooth disabilitato", "Vuoi attivare il Bluetooth?", [
        {
          text: "Annulla",
          style: "cancel",
        },
        {
          text: "Attiva",
          onPress: async () => {
            try {
              console.log("Monitor: 🔵 Tentativo attivazione Bluetooth...");
              await polarSdk.setBluetoothEnabled(true);
              console.log("Monitor: ✅ Bluetooth attivato");

              // Riprova la scansione dopo aver attivato Bluetooth
              setTimeout(() => startScan(), 1000);
            } catch (error: any) {
              console.error("Monitor: Errore attivazione Bluetooth:", error);
              Alert.alert(
                "Errore",
                "Impossibile attivare il Bluetooth automaticamente. Attivalo manualmente dalle impostazioni del dispositivo."
              );
            }
          },
        },
      ]);
      return;
    }

    // Reset flag e timestamp di scansione
    setDeviceFound(false);
    setFoundDeviceName("");
    setScanStartTime(Date.now());

    setScanningState(true);
    console.log("Monitor: 🔍 Avvio scansione Polar...");

    // Invia evento di scansione avviata ad Ably
    const userStateScan = useUserStore.getState();
    if (
      ablyService.current &&
      userStateScan.userId &&
      userStateScan.deviceCode
    ) {
      ablyService.current.sendMessage(
        userStateScan.userId,
        "scan_started",
        {
          action: "scan_started",
          timestamp: new Date().toISOString(),
        },
        userStateScan.deviceCode
      );
    }

    try {
      await polarSdk.startScan();

      // Timeout scansione completa
      setTimeout(async () => {
        const currentState = useScanStore.getState();
        if (currentState.isScanning) {
          await polarSdk.stopScan();
          setScanningState(false);
          console.log("Monitor: ⏱️ Timeout scansione completo");

          // Mostra l'alert solo se non è stato trovato un dispositivo E non c'è già un dispositivo connesso
          if (
            !currentState.deviceFoundDuringScan &&
            !currentState.connectedDeviceId
          ) {
            console.log(
              "Monitor: ⚠️ Nessun dispositivo trovato dopo timeout scansione - mostro alert"
            );

            Alert.alert(
              "Difficoltà di connessione",
              "Sembra che sia difficile connettersi con il tuo Polar360. Prova a spegnere e riaccendere il bluetooth per resettare la connessione manualmente.",
              [
                {
                  text: "Chiudi",
                  style: "cancel",
                },
              ]
            );
          }

          // Invia evento di scansione timeout ad Ably
          const userStateTimeout = useUserStore.getState();
          if (
            ablyService.current &&
            userStateTimeout.userId &&
            userStateTimeout.deviceCode
          ) {
            ablyService.current.sendMessage(
              userStateTimeout.userId,
              "scan_timeout",
              {
                action: "scan_timeout",
                reason: "timeout",
                duration: SCAN_TIMEOUT,
              },
              userStateTimeout.deviceCode
            );
          }
        }
      }, SCAN_TIMEOUT);
    } catch (error: any) {
      console.error("Monitor: Errore scansione:", error);
      setScanningState(false);

      Alert.alert(
        "Errore",
        `Impossibile avviare la scansione: ${error.message}`
      );
    }
  };

  const launchAuthAndStream = async (deviceId: string) => {
    try {
      // Step 1: Controlla se abbiamo dati di autenticazione salvati
      const storedAuthData = await StorageService.getAuthData();

      if (storedAuthData && storedAuthData.deviceToken) {
        console.log("Monitor: 🔍 Token salvato trovato, validazione...");

        // Valida il token chiamando il poll endpoint
        const pollResponse = await authService.current.pollDeviceAuth(
          storedAuthData.deviceToken
        );

        if (pollResponse && pollResponse.authenticated === true) {
          // Token valido, usa i dati salvati
          console.log("Monitor: ✅ Token valido, utilizzo dati salvati");
          console.log(
            "Monitor: 🔍 Stored data:",
            JSON.stringify(storedAuthData, null, 2)
          );

          setAuthToken(storedAuthData.authToken);
          console.log(
            `Monitor: 🔍 Setting userId from stored data: ${storedAuthData.userId}`
          );
          setUserId(storedAuthData.userId);
          setDeviceCode(storedAuthData.deviceCode);
          if (storedAuthData.appId) {
            setAppId(storedAuthData.appId);
          }

          // Connetti ad Ably
          console.log("🔵 Connessione Ably con token salvato...");
          ablyService.current?.connectWithToken(
            storedAuthData.authToken,
            storedAuthData.userId,
            storedAuthData.deviceCode
          );

          // Avvia streaming PPI
          console.log("💓 Avvio streaming PPI...");
          try {
            await polarSdk.startPpiStreaming(deviceId);
            console.log("✅ PPI streaming avviato con successo!");
          } catch (error: any) {
            console.log("⚠️ PPI non disponibile:", error.message);
            console.log("🔄 Usando modalità fallback: HRV calcolato da HR");
          }

          // Avvia invio periodico dei dati biometrici
          startBiometricSending();

          return;
        } else {
          // Token non valido, cancella i dati salvati
          console.log("Monitor: ❌ Token non valido, cancello dati salvati");
          await authService.current.clearAuthData();
        }
      }

      // Step 2: Nuovo flusso di autenticazione
      const authFlow = await authService.current.startAuthFlow();

      if (!authFlow.needsAuth && authFlow.storedData) {
        // Questa parte ora non dovrebbe essere raggiunta dato che abbiamo già gestito il caso sopra
        console.log("Monitor: ⚠️ Unexpected: needsAuth=false dopo validazione");
        return;
      }

      if (authFlow.newAuthResponse) {
        const authResponse = authFlow.newAuthResponse;
        setAuthCode(authResponse.code);
        console.log("Monitor: 🔑 Codice di autenticazione:", authResponse.code);
        console.log(
          "Monitor: 🎫 Device token da salvare:",
          authResponse.deviceToken
        );
        console.log(
          "Monitor: 🎫 Device token type:",
          typeof authResponse.deviceToken
        );
        console.log(
          "Monitor: 🎫 Device token length:",
          authResponse.deviceToken?.length
        );

        // Salva il device token per il polling
        await StorageService.saveDeviceToken(authResponse.deviceToken);
        console.log("Monitor: 🎫 Device token salvato nel storage");
      }

      // Step 3: Polling per conferma autenticazione (solo se non avevamo token salvato valido)
      pollInterval.current = setInterval(async () => {
        const currentDeviceToken = await StorageService.getDeviceToken();
        console.log("🔄 POLLING ATTIVO - deviceToken:", currentDeviceToken);
        console.log(
          "🔄 POLLING ATTIVO - deviceToken type:",
          typeof currentDeviceToken
        );

        console.log(
          "🔄 POLLING ATTIVO - deviceToken length:",
          currentDeviceToken?.length
        );

        if (currentDeviceToken) {
          console.log("🔄 POLLING ATTIVO - Chiamando pollDeviceAuth...");
          const pollResponse = await authService.current.pollDeviceAuth(
            currentDeviceToken
          );
          console.log("📥 POLL RESPONSE RAW:", pollResponse);
          console.log("📥 POLL RESPONSE TYPE:", typeof pollResponse);

          if (pollResponse) {
            console.log(
              "Monitor: 📥 Poll response:",
              JSON.stringify(pollResponse)
            );
            console.log(
              "Monitor: 📥 Poll response.authenticated:",
              pollResponse.authenticated
            );
            console.log(
              "Monitor: 📥 Poll response.authenticated type:",
              typeof pollResponse.authenticated
            );

            if (pollResponse.authenticated) {
              console.log(
                "Monitor: 🟢 Autenticato! User ID:",
                pollResponse.userId
              );
              console.log("🔥 AUTENTICAZIONE COMPLETATA - Avvio setup...");

              // Invia evento di autenticazione completata ad Ably
              if (ablyService.current) {
                ablyService.current.sendMessage(
                  parseInt(pollResponse.userId),
                  "authentication_completed",
                  {
                    userId: pollResponse.userId,
                    deviceCode: pollResponse.deviceCode,
                    authenticated: true,
                  },
                  pollResponse.deviceCode
                );
              }

              // Recupera il deviceToken per salvarlo insieme agli altri dati
              const currentDeviceToken = await StorageService.getDeviceToken();

              const authData: StoredAuthData = {
                authToken: pollResponse.session,
                userId: parseInt(pollResponse.userId),
                deviceCode: pollResponse.deviceCode,
                deviceToken: currentDeviceToken || "", // Token per validazione futura
                expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 ore
                deviceName: connectedDeviceName,
                deviceId: connectedDeviceId || undefined,
                appId: pollResponse.appId,
              };

              // Salva i dati di autenticazione
              await authService.current.saveAuthData(authData);

              setAuthToken(pollResponse.session);
              console.log(
                `Monitor: 🔍 Setting userId from poll response: ${pollResponse.userId}`
              );
              setUserId(parseInt(pollResponse.userId));
              setDeviceCode(pollResponse.deviceCode);
              if (pollResponse.appId) {
                setAppId(pollResponse.appId);
              }

              // Connetti ad Ably
              console.log("🔵 Connessione Ably...");
              ablyService.current?.connectWithToken(
                pollResponse.session,
                parseInt(pollResponse.userId),
                pollResponse.deviceCode
              );

              // Ferma il polling
              if (pollInterval.current) {
                clearInterval(pollInterval.current);
                console.log("⏸️ Polling fermato");
              }

              // Avvia streaming PPI con Polar SDK
              console.log("💓 Avvio streaming PPI...");
              try {
                await polarSdk.startPpiStreaming(deviceId);
                console.log("✅ PPI streaming avviato con successo!");
              } catch (error: any) {
                console.log("⚠️ PPI non disponibile:", error.message);
                console.log("🔄 Usando modalità fallback: HRV calcolato da HR");
              }

              // Avvia invio periodico dei dati biometrici
              startBiometricSending();
            } else {
              console.log("⏳ POLLING - authenticated: false");
            }
          } else {
            console.log("⏳ POLLING - no response");
          }
        } else {
          console.log("⚠️ POLLING - deviceToken è vuoto!");
        }
      }, 5000);
    } catch (error) {
      console.error("Monitor: Errore autenticazione:", error);
    }
  };

  const handlePpiData = (data: PolarPpiData) => {
    console.log(`Monitor: 🔬 Elaborazione ${data.samples.length} campioni PPI`);

    data.samples.forEach((sample) => {
      const ppiMs = sample.ppi;

      // Filtra valori implausibili
      if (ppiMs < 300 || ppiMs > 2000) {
        console.log(`Monitor: ⚠️ Filtrato PPI fuori range: ${ppiMs}ms`);
        return;
      }

      // Aggiungi alla finestra
      ppiWindow.current.push(ppiMs);
      if (ppiWindow.current.length > WINDOW_SIZE) {
        ppiWindow.current.shift();
      }

      console.log(
        `Monitor: 📈 Finestra PPI: ${ppiWindow.current.length}/${WINDOW_SIZE} campioni`
      );

      // Calcola HRV quando la finestra è piena
      if (ppiWindow.current.length === WINDOW_SIZE) {
        const rmssd = calculateRMSSD(ppiWindow.current);
        setHrv(Math.round(rmssd));

        // Calcola LF/HF
        const { lf, hf } = computeLfHf(ppiWindow.current);
        setLfPower(Math.round(lf));
        setHfPower(Math.round(hf));

        console.log(
          `Monitor: 📊 HRV=${Math.round(rmssd)}ms, LF=${Math.round(
            lf
          )}, HF=${Math.round(hf)}`
        );

        // Invia ad Ably
        const userStateHRV = useUserStore.getState();
        if (
          userStateHRV.authToken &&
          ablyStatus === ConnectionStatus.CONNECTED &&
          userStateHRV.userId &&
          userStateHRV.deviceCode
        ) {
          console.log(
            `Monitor: 🔍 Debug PPI - userId: ${userStateHRV.userId}, userIdRef: ${userIdRef.current}, deviceCode: ${userStateHRV.deviceCode}`
          );
          ablyService.current?.sendHeartRate(
            userStateHRV.deviceCode,
            userStateHRV.userId,
            heartRate,
            Math.round(rmssd),
            Math.round(lf),
            Math.round(hf)
          );

          // Invia evento completo con tutti i dati biometrici calcolati
          ablyService.current?.sendMessage(
            userStateHRV.userId,
            "heart_rate_complete",
            {
              deviceId: connectedDeviceId,
              heartRate: heartRate,
              hrv: Math.round(rmssd),
              lfPower: Math.round(lf),
              hfPower: Math.round(hf),
              windowSize: ppiWindow.current.length,
              contactDetected: true,
              contactSupported: true,
            },
            userStateHRV.deviceCode
          );

          console.log(
            `Monitor: 📤 HEART RATE COMPLETE EVENT SENT - HR: ${heartRate}, HRV: ${Math.round(
              rmssd
            )}, LF: ${Math.round(lf)}, HF: ${Math.round(hf)}`
          );
        }
      }
    });
  };

  const disconnectDevice = async () => {
    if (connectedDeviceId) {
      Alert.alert(
        "Disconnetti dispositivo",
        "Sei sicuro di voler disconnettere il dispositivo?",
        [
          {
            text: "Annulla",
            style: "cancel",
          },
          {
            text: "Disconnetti",
            style: "destructive",
            onPress: async () => {
              try {
                await polarSdk.disconnectFromDevice(connectedDeviceId);
                setConnectedDeviceId(null);
                setConnectedDeviceIdInStore(null);
                setConnectedDeviceName("");
                setFoundDeviceName("");
                if (pollInterval.current) {
                  clearInterval(pollInterval.current);
                }
                stopBiometricSending();
                ablyService.current?.close();

                // Reset stato del dispositivo
                resetDeviceState();

                console.log("Monitor: 🔌 Dispositivo disconnesso");
              } catch (error: any) {
                console.error("Monitor: Errore disconnessione:", error.message);
              }
            },
          },
        ]
      );
    }
  };

  const clearStoredAuth = async () => {
    try {
      await authService.current.clearAuthData();
      setAuthToken("");
      setUserId(0);
      setDeviceCode("");
      setAuthCode("");
      console.log("Monitor: 🗑️ Dati di autenticazione cancellati");
      Alert.alert(
        "Reset completato",
        "I dati di autenticazione sono stati cancellati. La prossima volta dovrai inserire il codice di nuovo."
      );
    } catch (error: any) {
      console.error("Monitor: Errore cancellazione dati:", error.message);
    }
  };

  const startBiometricSending = () => {
    // Ferma il timer esistente se presente
    if (biometricInterval.current) {
      clearInterval(biometricInterval.current);
    }

    // Avvia invio periodico dei dati biometrici ogni secondo
    biometricInterval.current = setInterval(() => {
      const userStateBiometric = useUserStore.getState();
      if (
        ablyService.current &&
        userStateBiometric.userId &&
        userStateBiometric.deviceCode &&
        heartRate > 0
      ) {
        // Invia dati biometrici ogni secondo
        ablyService.current.sendMessage(
          userStateBiometric.userId,
          "biometric_data",
          {
            heartRate: heartRate,
            hrv: hrv,
            lfPower: lfPower,
            hfPower: hfPower,
            ppiWindowSize: ppiWindow.current.length,
            timestamp: new Date().toISOString(),
          },
          userStateBiometric.deviceCode
        );

        console.log(
          `Monitor: 📤 BIOMETRIC EVENT SENT - HR: ${heartRate}, HRV: ${hrv}, LF: ${lfPower}, HF: ${hfPower}`
        );
      }
    }, 1000); // Ogni secondo
  };

  const stopBiometricSending = () => {
    if (biometricInterval.current) {
      clearInterval(biometricInterval.current);
      biometricInterval.current = null;
      console.log("Monitor: ⏹️ Fermato invio periodico dati biometrici");
    }
  };

  const resetDeviceState = () => {
    // Reset degli store
    resetScanState();
    resetUserState();

    // Reset metriche cardiache
    setHeartRate(0);
    setHrv(0);
    setLfPower(0);
    setHfPower(0);

    // Reset finestra PPI
    ppiWindow.current = [];

    console.log("Monitor: 🔄 Stato del dispositivo resettato");
  };

  const getBluetoothStateText = () => {
    return bluetoothPowered ? "🟢 Acceso" : "🔴 Spento";
  };

  const getStreamingStatusText = () => {
    // Se non c'è un dispositivo connesso, lo streaming è disconnesso
    if (!connectedDeviceId) {
      return "🔴 Disconnesso";
    }

    if (ablyStatus === ConnectionStatus.CONNECTED) {
      if (heartRate > 0) {
        return "🟢 Connesso";
      } else {
        return "🟠 In attesa dati";
      }
    } else if (ablyStatus === ConnectionStatus.CONNECTING) {
      return "🟡 Connessione...";
    } else {
      return "🔴 Disconnesso";
    }
  };

  const getDeviceStatusText = () => {
    if (connectedDeviceId && connectedDeviceName) {
      return `🟢 ${connectedDeviceName}`;
    } else {
      return "🔴 Nessun device";
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Notifica di autenticazione */}
      {notification && (
        <View
          style={[
            styles.notification,
            notification.type === "success"
              ? styles.notificationSuccess
              : styles.notificationError,
          ]}
        >
          {notification.type === "success" ? (
            <CheckCircle size={24} color="#fff" />
          ) : notification.message.includes("disconnesso") ? (
            <Unplug size={24} color="#fff" />
          ) : (
            <XCircle size={24} color="#fff" />
          )}
          <ThemedText style={styles.notificationText}>
            {notification.message}
          </ThemedText>
          {/* Pulsante di chiusura */}
          <TouchableOpacity
            onPress={() => setNotification(null)}
            style={styles.notificationCloseButton}
          >
            <XCircle size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            {connectedDeviceName || "Polar Monitor"}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {connectedDeviceName
              ? "Monitoraggio cardiaco avanzato con HRV"
              : "Connetti un dispositivo Polar per iniziare"}
          </ThemedText>
        </ThemedView>

        {/* Stati */}
        <ThemedView style={styles.statusSection}>
          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>Bluetooth:</ThemedText>
            <ThemedText style={styles.statusValue}>
              {getBluetoothStateText()}
            </ThemedText>
          </View>
          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>Device connesso:</ThemedText>
            <ThemedText style={styles.statusValue}>
              {getDeviceStatusText()}
            </ThemedText>
          </View>
          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>Streaming:</ThemedText>
            <ThemedText style={styles.statusValue}>
              {getStreamingStatusText()}
            </ThemedText>
          </View>
          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>Device Code:</ThemedText>
            <ThemedText style={styles.statusValue}>
              {deviceCode || "N/A"}
            </ThemedText>
          </View>
          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>User ID:</ThemedText>
            <ThemedText style={styles.statusValue}>
              {userId || "N/A"}
            </ThemedText>
          </View>
          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>App ID:</ThemedText>
            <ThemedText style={styles.statusValue}>{appId || "N/A"}</ThemedText>
          </View>
          {!authToken && connectedDeviceId && authCode && (
            <View style={styles.authCodeContainer}>
              <ThemedText style={styles.authCodeLabel}>
                Inserisci questo codice sul PC:
              </ThemedText>
              <ThemedText style={styles.authCode}>{authCode}</ThemedText>
            </View>
          )}
        </ThemedView>

        {/* Metriche cardiache */}
        <ThemedView style={styles.metricsSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Metriche Cardiache
          </ThemedText>

          {connectedDeviceId && heartRate === 0 && (
            <ThemedText style={styles.waitingText}>
              ⏳ In attesa di dati dal dispositivo...
            </ThemedText>
          )}

          <View style={styles.metricsGrid}>
            <View
              style={[styles.metricCard, { borderColor: Colors[theme].border }]}
            >
              <View style={styles.metricIconContainer}>
                <Heart size={24} color={Colors[theme].tint} />
              </View>
              <ThemedText style={styles.metricLabel}>Heart Rate</ThemedText>
              <ThemedText style={styles.metricValue}>
                {connectedDeviceId && heartRate > 0 ? heartRate : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>BPM</ThemedText>
            </View>

            <View
              style={[styles.metricCard, { borderColor: Colors[theme].border }]}
            >
              <View style={styles.metricIconContainer}>
                <Activity size={24} color={Colors[theme].tint} />
              </View>
              <ThemedText style={styles.metricLabel}>HRV (RMSSD)</ThemedText>
              <ThemedText style={styles.metricValue}>
                {connectedDeviceId && hrv > 0 ? hrv : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>
                {connectedDeviceId && hrv > 0
                  ? "ms"
                  : connectedDeviceId && ppiWindow.current.length > 0
                  ? `${ppiWindow.current.length}/${WINDOW_SIZE}`
                  : "ms"}
              </ThemedText>
            </View>

            <View
              style={[styles.metricCard, { borderColor: Colors[theme].border }]}
            >
              <View style={styles.metricIconContainer}>
                <Zap size={24} color={Colors[theme].tint} />
              </View>
              <ThemedText style={styles.metricLabel}>LF Power</ThemedText>
              <ThemedText style={styles.metricValue}>
                {connectedDeviceId && lfPower > 0 ? lfPower : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>ms²</ThemedText>
            </View>

            <View
              style={[styles.metricCard, { borderColor: Colors[theme].border }]}
            >
              <View style={styles.metricIconContainer}>
                <Zap size={24} color={Colors[theme].tint} />
              </View>
              <ThemedText style={styles.metricLabel}>HF Power</ThemedText>
              <ThemedText style={styles.metricValue}>
                {connectedDeviceId && hfPower > 0 ? hfPower : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>ms²</ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Controlli */}
        <ThemedView style={styles.controlsSection}>
          {!connectedDeviceId ? (
            <>
              {foundDeviceName ? (
                <ThemedView style={styles.successMessage}>
                  <ThemedText style={styles.successText}>
                    ✅ Trovato device {foundDeviceName}
                  </ThemedText>
                </ThemedView>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.scanButton,
                    { backgroundColor: Colors[theme].tint },
                  ]}
                  onPress={startScan}
                  disabled={isScanning || !bluetoothPowered}
                >
                  {isScanning ? (
                    <>
                      <ActivityIndicator
                        color="#fff"
                        style={{ marginRight: 10 }}
                      />
                      <ThemedText style={styles.buttonText}>
                        Scansione in corso...
                      </ThemedText>
                    </>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Search size={20} color="#fff" />
                      <ThemedText style={styles.buttonText}>
                        Cerca Dispositivo Polar
                      </ThemedText>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.connectedButtons}>
              <TouchableOpacity
                style={[styles.button, styles.disconnectButton]}
                onPress={disconnectDevice}
              >
                <ThemedText style={styles.buttonText}>
                  Disconnetti {connectedDeviceName}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Pulsante per cancellare dati salvati - solo in debug mode */}
          {authToken && debugMode && (
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={clearStoredAuth}
            >
              <View style={styles.buttonContent}>
                <Trash2 size={16} color="#fff" />
                <ThemedText style={styles.buttonText}>
                  Cancella Token Salvato
                </ThemedText>
              </View>
            </TouchableOpacity>
          )}
        </ThemedView>

        {/* Info */}
        <ThemedView style={styles.infoSection}>
          <ThemedText style={styles.infoText}>
            I dispositivi Polar 360 si connettono alla piattaforma Become per
            offrire esperienze VR immersive e reattive. I dati biometrici
            raccolti vengono trasmessi in tempo reale alle applicazioni Become,
            consentendo un&apos;interazione precisa tra corpo e ambiente
            virtuale.
          </ThemedText>

          <ThemedText style={styles.infoText}>
            Il sistema effettua un monitoraggio avanzato della frequenza
            cardiaca e calcola metriche HRV (RMSSD) con analisi delle bande
            LF/HF, fornendo un feedback fisiologico continuo per adattare
            dinamicamente la scena VR in base allo stato dell&apos;utente.
          </ThemedText>
        </ThemedView>

        {/* Footer */}
        <AppFooter />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  statusSection: {
    padding: 20,
    paddingTop: 10,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusValue: {
    fontSize: 16,
  },
  authCodeContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FF9800",
  },
  authCodeLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  authCode: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#FF9800",
    letterSpacing: 4,
  },
  notification: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationSuccess: {
    backgroundColor: "#10B981", // Verde
  },
  notificationError: {
    backgroundColor: "#EF4444", // Rosso
  },
  notificationText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
    flex: 1,
  },
  notificationCloseButton: {
    padding: 4,
    marginLeft: 8,
  },
  metricsSection: {
    padding: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    marginBottom: 15,
  },
  waitingText: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 10,
    textAlign: "center",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  metricIconContainer: {
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
    fontWeight: "500",
    textAlign: "center",
  },
  metricValue: {
    fontSize: 32,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  metricUnit: {
    fontSize: 14,
    opacity: 0.6,
    fontWeight: "400",
    textAlign: "center",
  },
  controlsSection: {
    padding: 20,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  scanButton: {
    // backgroundColor set dynamically
  },
  disconnectButton: {
    backgroundColor: "#F44336",
  },
  reconnectButton: {
    backgroundColor: "#2196F3",
    marginTop: 10,
  },
  ablyReconnectButton: {
    backgroundColor: "#9C27B0",
    marginTop: 10,
  },
  connectedButtons: {
    width: "100%",
  },
  clearButton: {
    backgroundColor: "#FF9800",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  successMessage: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderWidth: 2,
    borderColor: "#4CAF50",
    alignItems: "center",
  },
  successText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4CAF50",
  },
  infoSection: {
    padding: 20,
    paddingTop: 10,
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
});
