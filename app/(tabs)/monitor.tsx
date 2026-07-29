/**
 * Monitor Tab
 * Migrazione del codice legacy per il monitoraggio cardiaco Polar
 */

import { AppFooter } from "@/components/app-footer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getApiBaseUrl } from "@/constants/constants";
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
import {
  ensurePolarReady,
  startPpiStreamingWithFallback,
} from "@/services/polar-device-setup";
import {
  getPolarProductBadge,
  isSupportedPolarDevice,
  resolvePolarProduct,
} from "@/services/polar-products";
import { resolveRrInterval } from "@/services/rr-interval";
import {
  flushSessionTrack,
  startSessionOfflineRecording,
} from "@/services/session-track-flush";
import { sessionTrackBuffer } from "@/services/session-track-buffer";
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
  PermissionsAndroid,
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
    discoveredDevices,
    upsertDiscoveredDevice,
    clearDiscoveredDevices,
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
  const { debugMode, developerMode } = useSettingsStore();

  // Bluetooth & Polar
  const [bluetoothPowered, setBluetoothPowered] = useState(false);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(
    null
  );
  const [connectedDeviceName, setConnectedDeviceName] = useState<string>("");
  const [foundDeviceName, setFoundDeviceName] = useState<string>("");
  const [isConnectingSelected, setIsConnectingSelected] = useState(false);

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
  const [rrMs, setRrMs] = useState(0);
  const [rrSource, setRrSource] = useState<"ppi" | "hr_derived" | null>(null);
  const [isFlushingTrack, setIsFlushingTrack] = useState(false);
  const [offlineRecordingStarted, setOfflineRecordingStarted] = useState(false);
  const heartRateRef = useRef(0);
  const hrvRef = useRef(0);
  const lfPowerRef = useRef(0);
  const hfPowerRef = useRef(0);
  const connectedDeviceNameRef = useRef("");
  const connectedDeviceIdRef = useRef<string | null>(null);
  const flushInFlightRef = useRef(false);
  const rrSourceRef = useRef<"ppi" | "hr_derived" | null>(null);

  useEffect(() => {
    heartRateRef.current = heartRate;
  }, [heartRate]);
  useEffect(() => {
    hrvRef.current = hrv;
  }, [hrv]);
  useEffect(() => {
    lfPowerRef.current = lfPower;
  }, [lfPower]);
  useEffect(() => {
    hfPowerRef.current = hfPower;
  }, [hfPower]);
  useEffect(() => {
    connectedDeviceNameRef.current = connectedDeviceName;
  }, [connectedDeviceName]);
  useEffect(() => {
    connectedDeviceIdRef.current = connectedDeviceId;
  }, [connectedDeviceId]);
  useEffect(() => {
    rrSourceRef.current = rrSource;
  }, [rrSource]);

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
  /** Prevents overlapping launchAuthAndStream / Ably reconnect storms. */
  const authStreamInFlightRef = useRef(false);
  const streamReadyDeviceRef = useRef<string | null>(null);
  /** Device currently going through auth/FTU/poll (survives until ready or disconnect). */
  const authSessionDeviceRef = useRef<string | null>(null);
  const pairingBlockedRef = useRef(false);
  /** After fresh FTU the Polar restarts; wait for next connect before PPI. */
  const pendingPostFtuReconnectRef = useRef<string | null>(null);

  useEffect(() => {
    // Inizializza Ably service
    console.log("Monitor: 🔵 Inizializzazione AblyService...");
    const apiBaseUrl = getApiBaseUrl();
    ablyService.current = new AblyService(
      apiBaseUrl + "/services/ably",
      (status) => {
        setAblyStatus(status);
        console.log("Monitor: 🔵 Ably status:", status);
        console.log("Monitor: 🔵 AblyService instance:", !!ablyService.current);
      }
    );

    console.log(
      "Monitor: 🔵 AblyService inizializzato:",
      !!ablyService.current
    );

    ablyService.current.setEndSessionHandler((payload) => {
      console.log("Monitor: 📥 Ably endSession", payload);
      handleFlushTrack(payload?.sessionId ?? null);
    });

    // Controlla stato Bluetooth iniziale e prova a riconnettersi
    const initializeBluetooth = async () => {
      const powered = await polarSdk.checkBluetoothState();
      console.log(
        `Monitor: Stato Bluetooth iniziale: ${powered ? "ON" : "OFF"}`
      );
      setBluetoothPowered(powered);

      if (powered) {
        const lastDeviceId = await StorageService.getLastDeviceId();
        const storedAuthData = lastDeviceId
          ? await StorageService.getAuthDataForDevice(lastDeviceId)
          : await StorageService.getAuthData();
        if (
          storedAuthData &&
          storedAuthData.deviceId &&
          !pairingBlockedRef.current
        ) {
          console.log(
            `Monitor: Tentativo riconnessione a ${
              storedAuthData.deviceName || storedAuthData.deviceId
            }`
          );
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

      // Non inviamo più eventi bluetooth_state_changed separati

      // Se il Bluetooth si riaccende e non abbiamo un dispositivo connesso,
      // prova a riconnettersi al dispositivo salvato
      if (state.powered && !connectedDeviceId) {
        const tryReconnect = async () => {
          const lastDeviceId = await StorageService.getLastDeviceId();
          const storedAuthData = lastDeviceId
            ? await StorageService.getAuthDataForDevice(lastDeviceId)
            : await StorageService.getAuthData();
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

      if (!isSupportedPolarDevice(device.name)) {
        console.log(`Monitor: ⏭️ Ignorato (non supportato): ${device.name}`);
        return;
      }

      const product = resolvePolarProduct(device.name);
      if (!product) {
        return;
      }

      setDeviceFound(true);
      setFoundDeviceName(device.name);
      upsertDiscoveredDevice({
        deviceId: device.deviceId,
        name: device.name,
        productId: product.id,
        displayName: product.displayName,
      });

      // Solo dopo FTU+restart: riconnetti automaticamente allo stesso deviceId
      if (pendingPostFtuReconnectRef.current === device.deviceId) {
        console.log(
          `Monitor: 🔁 Post-FTU reconnect automatico a ${device.deviceId}`
        );
        pendingPostFtuReconnectRef.current = null;
        polarSdk.stopScan();
        setScanningState(false);
        polarSdk.connectToDevice(device.deviceId);
      }
    });

    polarSdk.addEventListener(
      "onDeviceConnected",
      (device: PolarDeviceInfo) => {
        console.log(`Monitor: ✅ Connesso a ${device.name}!`);
        setIsConnectingSelected(false);
        setConnectedDeviceId(device.deviceId);
        setConnectedDeviceIdInStore(device.deviceId);
        setConnectedDeviceName(device.name);
        setFoundDeviceName("");
        clearDiscoveredDevices();

        StorageService.setLastDeviceId(device.deviceId);
        StorageService.updateDeviceName(device.name, device.deviceId);
        StorageService.updateDeviceId(device.deviceId);

        // Skip auth/stream restart if already ready or in progress for this device
        if (
          pairingBlockedRef.current ||
          streamReadyDeviceRef.current === device.deviceId ||
          authSessionDeviceRef.current === device.deviceId ||
          authStreamInFlightRef.current
        ) {
          return;
        }

        launchAuthAndStream(device.deviceId);
      }
    );

    polarSdk.addEventListener(
      "onDeviceDisconnected",
      (device: PolarDeviceInfo) => {
        console.log("Monitor: ⚠️ Dispositivo disconnesso");

        const expectedFtuRestart =
          pendingPostFtuReconnectRef.current === device.deviceId;

        if (expectedFtuRestart) {
          setNotification({
            type: "success",
            message: "Polar riavviato dopo configurazione — riconnessione…",
          });
          // Bond already exists: scan and auto-reconnect same deviceId when it advertises.
          polarSdk.startScan().catch(() => {});
          setScanningState(true);
        } else {
          setNotification({
            type: "error",
            message: `Dispositivo disconnesso`,
          });
          pendingPostFtuReconnectRef.current = null;
        }

        // Auto-close dopo 5 secondi
        setTimeout(() => {
          setNotification(null);
        }, 5000);

        setConnectedDeviceId(null);
        setConnectedDeviceIdInStore(null);
        setConnectedDeviceName("");
        setFoundDeviceName("");
        setIsConnectingSelected(false);
        authStreamInFlightRef.current = false;
        streamReadyDeviceRef.current = null;
        authSessionDeviceRef.current = null;
        // Keep pendingPostFtuReconnectRef across expected FTU restart disconnect
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
        stopBiometricSending();
        polarSdk.stopMonitorForegroundService().catch(() => {});
        ablyService.current?.close();

        // Reset stato del dispositivo
        resetDeviceState();
        if (expectedFtuRestart) {
          // resetScanState clears isScanning; keep scanning for post-FTU reconnect
          setScanningState(true);
        }
      }
    );

    polarSdk.addEventListener("onPairingFailed", (payload: any) => {
      console.warn("Monitor: pairing BLE fallito", payload);
      pairingBlockedRef.current = true;
      authStreamInFlightRef.current = false;
      streamReadyDeviceRef.current = null;
      authSessionDeviceRef.current = null;
      Alert.alert(
        "Pairing Bluetooth fallito",
        "Il Polar rifiuta l'abbinamento (chiavi BLE non valide).\n\n1) Impostazioni → Bluetooth → dimentica il Polar (360 o Loop)\n2) Factory reset del Polar (in carica, reset nascosto)\n3) Riapri Augmented Monitor e accetta il popup di pairing"
      );
    });

    polarSdk.addEventListener("onHeartRateReceived", (data: PolarHrData) => {
      console.log(`Monitor: 💓 HR=${data.hr} BPM`);
      setHeartRate(data.hr);

      // Se non ci sono dati PPI, calcola RR approssimato da BPM come fallback
      if (data.hr > 0) {
        const approximateRR = Math.round(60000 / data.hr);
        const resolved = resolveRrInterval({ hrBpm: data.hr });
        if (resolved && rrSourceRef.current !== "ppi") {
          setRrMs(resolved.rrMs);
          setRrSource(resolved.rrSource);
          sessionTrackBuffer.pushHr(data.hr);
        }

        ppiWindow.current.push(approximateRR);
        if (ppiWindow.current.length > WINDOW_SIZE) {
          ppiWindow.current.shift();
        }

        // Calcola HRV quando la finestra è piena
        let hrvValue = null;
        let lfPowerValue = null;
        let hfPowerValue = null;

        if (ppiWindow.current.length === WINDOW_SIZE) {
          const rmssd = calculateRMSSD(ppiWindow.current);
          const roundedRmsdd = Math.round(rmssd);
          setHrv(roundedRmsdd);
          hrvValue = roundedRmsdd;

          const { lf, hf } = computeLfHf(ppiWindow.current);
          const roundedLf = Math.round(lf);
          const roundedHf = Math.round(hf);
          setLfPower(roundedLf);
          setHfPower(roundedHf);
          lfPowerValue = roundedLf;
          hfPowerValue = roundedHf;

          console.log(
            `Monitor: 📊 HRV (da HR)=${roundedRmsdd}ms, LF=${roundedLf}, HF=${roundedHf}`
          );
        }

        // Streamma sempre appena c'è HR
        const userStateHRFallback = useUserStore.getState();
        console.log("🔍 HR FALLBACK - Controllo condizioni:");
        console.log("🔍 authToken:", !!userStateHRFallback.authToken);
        console.log("🔍 ablyStatus:", ablyStatus);
        console.log("🔍 userId:", userStateHRFallback.userId);
        console.log("🔍 deviceCode:", userStateHRFallback.deviceCode);
        console.log("🔍 ablyService.current:", !!ablyService.current);

        if (
          userStateHRFallback.authToken &&
          ablyService.current &&
          userStateHRFallback.userId &&
          userStateHRFallback.deviceCode
        ) {
          console.log("✅ HR FALLBACK - Invio dati ad Ably");
          const timestamp = new Date().toISOString();
          ablyService.current.sendMessage(
            userStateHRFallback.userId,
            "heartRate",
            {
              deviceId: connectedDeviceId,
              heartRate: data.hr,
              hrv: hrvValue,
              lfPower: lfPowerValue,
              hfPower: hfPowerValue,
              date: timestamp,
            },
            userStateHRFallback.deviceCode
          );
        } else {
          console.log("❌ HR FALLBACK - Condizioni non soddisfatte");
        }
      }
    });

    polarSdk.addEventListener("onPpiDataReceived", (data: PolarPpiData) => {
      console.log(
        `Monitor: 📊 PPI Data ricevuto - ${data.samples.length} samples`
      );

      handlePpiData(data);
    });

    polarSdk.addEventListener("onPpiStreamError", (error: any) => {
      console.log("Monitor: ⚠️ PPI Stream Error:", error.error);
      console.log("Monitor: 🔄 Modalità fallback attiva (HRV da HR)");
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
      polarSdk.stopMonitorForegroundService().catch(() => {});
      ablyService.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developerMode]);

  const setScanningState = (value: boolean) => {
    setScanning(value);
  };

  const ensureMonitorForegroundService = async () => {
    if (Platform.OS !== "android") return;
    try {
      // Android 13+: notification permission required for a visible FGS notification
      if (Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      }
      await polarSdk.startMonitorForegroundService(
        connectedDeviceNameRef.current ||
          connectedDeviceIdRef.current ||
          "Polar"
      );
    } catch (error: any) {
      console.error("Monitor: FGS start failed:", error?.message);
    }
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
    // Manual scan = user intends a fresh pairing attempt after fixing bonds.
    pairingBlockedRef.current = false;

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
    clearDiscoveredDevices();
    setScanStartTime(Date.now());

    setScanningState(true);
    console.log("Monitor: 🔍 Avvio scansione Polar...");

    try {
      await polarSdk.startScan();

      // Timeout scansione completa
      setTimeout(async () => {
        const currentState = useScanStore.getState();
        if (currentState.isScanning) {
          await polarSdk.stopScan();
          setScanningState(false);
          console.log("Monitor: ⏱️ Timeout scansione completo");

          // Alert solo se nessun device supportato trovato e nessuno connesso
          if (
            !currentState.deviceFoundDuringScan &&
            currentState.discoveredDevices.length === 0 &&
            !currentState.connectedDeviceId
          ) {
            console.log(
              "Monitor: ⚠️ Nessun dispositivo trovato dopo timeout scansione - mostro alert"
            );

            Alert.alert(
              "Difficoltà di connessione",
              "Nessun Polar 360 o Loop trovato. Prova a spegnere e riaccendere il Bluetooth, poi ripeti la ricerca.",
              [
                {
                  text: "Chiudi",
                  style: "cancel",
                },
              ]
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

  const selectAndConnect = async (deviceId: string) => {
    if (pairingBlockedRef.current || isConnectingSelected) {
      return;
    }
    console.log(`Monitor: 👆 Selezione device ${deviceId}`);
    setIsConnectingSelected(true);
    try {
      await polarSdk.stopScan();
      setScanningState(false);
      await StorageService.setLastDeviceId(deviceId);
      await polarSdk.connectToDevice(deviceId);
    } catch (error: any) {
      setIsConnectingSelected(false);
      console.error("Monitor: Errore connessione selezionata:", error);
      Alert.alert(
        "Errore",
        `Impossibile connettersi: ${error?.message || "sconosciuto"}`
      );
    }
  };

  const launchAuthAndStream = async (deviceId: string) => {
    if (
      pairingBlockedRef.current ||
      authStreamInFlightRef.current ||
      streamReadyDeviceRef.current === deviceId ||
      authSessionDeviceRef.current === deviceId
    ) {
      return;
    }
    authStreamInFlightRef.current = true;
    authSessionDeviceRef.current = deviceId;
    try {
      // FTU prima di auth/streaming: se appena eseguito, il Polar riavvia e
      // riprenderemo auth+PPI alla prossima onDeviceConnected.
      console.log("🩺 Verifica First Time Use...");
      const polarReady = await ensurePolarReady(deviceId, polarSdk);
      if (polarReady.status === "deferred") {
        console.log("✅ First Time Use ok (restart pending)");
        pendingPostFtuReconnectRef.current = deviceId;
        authSessionDeviceRef.current = null;
        setNotification({
          type: "success",
          message:
            "Polar configurato — riavvio in corso. Ricollega se non riparte da solo.",
        });
        setTimeout(() => setNotification(null), 8000);
        return;
      }
      if (polarReady.status === "failed") {
        console.error("Monitor: ❌ FTU fallito:", polarReady.error);
        authSessionDeviceRef.current = null;
        setNotification({
          type: "error",
          message:
            "Configura Polar 360 fallita — reset di fabbrica se già abbinato altrove",
        });
        setTimeout(() => setNotification(null), 8000);
        return;
      }
      console.log("✅ First Time Use ok");

      // Step 1: Controlla se abbiamo dati di autenticazione salvati per questo device
      const storedAuthData = await StorageService.getAuthDataForDevice(deviceId);

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

          console.log("💓 Avvio streaming PPI...");
          await startPpiStreamingWithFallback(deviceId, polarSdk);

          // Avvia invio periodico dei dati biometrici
          startBiometricSending();
          streamReadyDeviceRef.current = deviceId;
          await ensureMonitorForegroundService();
          await beginOfflineTrack(deviceId);

          return;
        } else {
          // Token non valido, cancella i dati salvati per questo device
          console.log("Monitor: ❌ Token non valido, cancello dati salvati");
          await authService.current.clearAuthData(deviceId);
        }
      }

      // Step 2: Nuovo flusso di autenticazione (scoped al device)
      const authFlow = await authService.current.startAuthFlow(deviceId);

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

        // Salva il device token per il polling (per questo device)
        await StorageService.saveDeviceTokenForDevice(
          deviceId,
          authResponse.deviceToken
        );
        console.log("Monitor: 🎫 Device token salvato nel storage");
      }

      // Step 3: Polling per conferma autenticazione (solo se non avevamo token salvato valido)
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
      let pollHandlingAuth = false;
      pollInterval.current = setInterval(async () => {
        if (pollHandlingAuth || streamReadyDeviceRef.current === deviceId) {
          return;
        }
        const currentDeviceToken =
          await StorageService.getDeviceTokenForDevice(deviceId);
        console.log("🔄 POLLING ATTIVO - deviceToken:", currentDeviceToken);

        if (currentDeviceToken) {
          console.log("🔄 POLLING ATTIVO - Chiamando pollDeviceAuth...");
          const pollResponse = await authService.current.pollDeviceAuth(
            currentDeviceToken
          );
          console.log("📥 POLL RESPONSE RAW:", pollResponse);

          if (pollResponse) {
            console.log(
              "Monitor: 📥 Poll response:",
              JSON.stringify(pollResponse)
            );

            if (pollResponse.authenticated) {
              if (pollHandlingAuth || streamReadyDeviceRef.current === deviceId) {
                return;
              }
              pollHandlingAuth = true;
              // Ferma il polling immediatamente per evitare connectWithToken ripetuti
              if (pollInterval.current) {
                clearInterval(pollInterval.current);
                pollInterval.current = null;
                console.log("⏸️ Polling fermato");
              }

              console.log(
                "Monitor: 🟢 Autenticato! User ID:",
                pollResponse.userId
              );
              console.log("🔥 AUTENTICAZIONE COMPLETATA - Avvio setup...");

              const currentDeviceToken =
                await StorageService.getDeviceTokenForDevice(deviceId);

              const authData: StoredAuthData = {
                authToken: pollResponse.session,
                userId: parseInt(pollResponse.userId),
                deviceCode: pollResponse.deviceCode,
                deviceToken: currentDeviceToken || "",
                expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
                deviceName: connectedDeviceNameRef.current,
                deviceId,
                appId: pollResponse.appId,
              };

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

              console.log("🔵 Connessione Ably...");
              ablyService.current?.connectWithToken(
                pollResponse.session,
                parseInt(pollResponse.userId),
                pollResponse.deviceCode
              );

              console.log("💓 Avvio streaming PPI...");
              await startPpiStreamingWithFallback(deviceId, polarSdk);

              startBiometricSending();
              streamReadyDeviceRef.current = deviceId;
              await ensureMonitorForegroundService();
              await beginOfflineTrack(deviceId);
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
    } finally {
      authStreamInFlightRef.current = false;
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

      const resolved = resolveRrInterval({
        ppiMs,
        hrBpm: sample.hr > 0 ? sample.hr : heartRateRef.current,
      });
      if (resolved) {
        setRrMs(resolved.rrMs);
        setRrSource(resolved.rrSource);
        rrSourceRef.current = resolved.rrSource;
      }
      sessionTrackBuffer.pushPpi({
        ppiMs,
        hr: sample.hr > 0 ? sample.hr : undefined,
        errorEstimate: sample.errorEstimate,
        blockerBit: sample.blocker,
      });

      // Aggiungi alla finestra
      ppiWindow.current.push(ppiMs);
      if (ppiWindow.current.length > WINDOW_SIZE) {
        ppiWindow.current.shift();
      }

      console.log(
        `Monitor: 📈 Finestra PPI: ${ppiWindow.current.length}/${WINDOW_SIZE} campioni`
      );

      // Calcola HRV quando la finestra è piena
      let hrvValue = null;
      let lfPowerValue = null;
      let hfPowerValue = null;

      if (ppiWindow.current.length === WINDOW_SIZE) {
        const rmssd = calculateRMSSD(ppiWindow.current);
        const roundedRmsdd = Math.round(rmssd);
        setHrv(roundedRmsdd);
        hrvValue = roundedRmsdd;

        // Calcola LF/HF
        const { lf, hf } = computeLfHf(ppiWindow.current);
        const roundedLf = Math.round(lf);
        const roundedHf = Math.round(hf);
        setLfPower(roundedLf);
        setHfPower(roundedHf);
        lfPowerValue = roundedLf;
        hfPowerValue = roundedHf;

        console.log(
          `Monitor: 📊 HRV=${roundedRmsdd}ms, LF=${roundedLf}, HF=${roundedHf}`
        );
      }

      // Streamma sempre se HR è disponibile
      if (heartRate > 0) {
        const userStateHRV = useUserStore.getState();
        console.log("🔍 DEBUG STREAMING - Controllo condizioni:");
        console.log("🔍 authToken:", !!userStateHRV.authToken);
        console.log("🔍 ablyStatus:", ablyStatus);
        console.log("🔍 userId:", userStateHRV.userId);
        console.log("🔍 deviceCode:", userStateHRV.deviceCode);
        console.log("🔍 heartRate:", heartRate);
        console.log("🔍 ablyService.current:", !!ablyService.current);

        if (
          userStateHRV.authToken &&
          ablyService.current &&
          userStateHRV.userId &&
          userStateHRV.deviceCode
        ) {
          console.log(
            "✅ TUTTE LE CONDIZIONI SODDISFATTE - Invio dati ad Ably"
          );
          const timestamp = new Date().toISOString();
          ablyService.current.sendMessage(
            userStateHRV.userId,
            "heartRate",
            {
              deviceId: connectedDeviceId,
              heartRate: heartRate,
              hrv: hrvValue,
              lfPower: lfPowerValue,
              hfPower: hfPowerValue,
              date: timestamp,
            },
            userStateHRV.deviceCode
          );
        } else {
          console.log("❌ CONDIZIONI NON SODDISFATTE - Non invio dati ad Ably");
        }
      }
    });
  };

  const beginOfflineTrack = async (deviceId: string) => {
    const result = await startSessionOfflineRecording(deviceId);
    setOfflineRecordingStarted(result.started);
    if (result.started) {
      setNotification({
        type: "success",
        message: "Offline PPI recording avviato sul Polar",
      });
    } else {
      setNotification({
        type: "success",
        message: "Offline recording non disponibile — buffer live attivo",
      });
    }
    setTimeout(() => setNotification(null), 5000);
  };

  const handleFlushTrack = async (sessionId?: string | null) => {
    const deviceId = connectedDeviceIdRef.current;
    if (!deviceId) {
      Alert.alert("Flush track", "Nessun dispositivo connesso.");
      return;
    }
    if (flushInFlightRef.current) {
      return;
    }
    flushInFlightRef.current = true;
    setIsFlushingTrack(true);
    try {
      const userState = useUserStore.getState();
      const result = await flushSessionTrack({
        deviceId,
        deviceCode: userState.deviceCode || undefined,
        userId: userState.userId || undefined,
        authToken: userState.authToken || undefined,
        sessionId: sessionId ?? null,
      });
      setOfflineRecordingStarted(false);
      setNotification({
        type: "success",
        message: result.dryRun
          ? `Track flushed (dry-run) · ${result.sampleCount} sample · ${result.source}`
          : `Track uploaded · ${result.sampleCount} sample · ${result.source}`,
      });
      setTimeout(() => setNotification(null), 8000);
    } catch (error: any) {
      console.error("Monitor: flush track failed", error);
      Alert.alert(
        "Flush track fallito",
        error?.message || "Errore sconosciuto"
      );
    } finally {
      flushInFlightRef.current = false;
      setIsFlushingTrack(false);
    }
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
                polarSdk.stopMonitorForegroundService().catch(() => {});
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
      if (connectedDeviceId) {
        await authService.current.clearAuthData(connectedDeviceId);
      } else {
        await authService.current.clearAuthData();
      }
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
      const hr = heartRateRef.current;
      const currentHrv = hrvRef.current;
      const lf = lfPowerRef.current;
      const hf = hfPowerRef.current;
      const deviceLabel =
        connectedDeviceNameRef.current ||
        connectedDeviceIdRef.current ||
        "Polar";

      if (debugMode) {
        console.log("🔍 DEBUG BIOMETRIC SENDING - Controllo condizioni:");
        console.log("🔍 ablyService.current:", !!ablyService.current);
        console.log("🔍 userId:", userStateBiometric.userId);
        console.log("🔍 deviceCode:", userStateBiometric.deviceCode);
        console.log("🔍 heartRate:", hr);
        console.log("🔍 ablyStatus:", ablyStatus);
      }

      if (
        ablyService.current &&
        userStateBiometric.authToken &&
        userStateBiometric.userId &&
        userStateBiometric.deviceCode &&
        hr > 0
      ) {
        console.log("✅ BIOMETRIC SENDING - Invio dati ad Ably");
        const timestamp = new Date().toISOString();
        ablyService.current.sendMessage(
          userStateBiometric.userId,
          "heartRate",
          {
            deviceId: connectedDeviceIdRef.current,
            hr,
            hrv: currentHrv > 0 ? currentHrv : null,
            lfPower: lf > 0 ? lf : null,
            hfPower: hf > 0 ? hf : null,
            date: timestamp,
          },
          userStateBiometric.deviceCode
        );
      } else {
        const isCriticalIssue =
          !ablyService.current ||
          !userStateBiometric.authToken ||
          !userStateBiometric.userId ||
          !userStateBiometric.deviceCode;
        const isHeartRateIssue = hr === 0;

        if (isCriticalIssue || (isHeartRateIssue && debugMode)) {
          console.log("❌ BIOMETRIC SENDING - Condizioni non soddisfatte:");
          console.log("  - ablyService.current:", !!ablyService.current);
          console.log("  - authToken:", !!userStateBiometric.authToken);
          console.log("  - userId:", userStateBiometric.userId);
          console.log("  - deviceCode:", userStateBiometric.deviceCode);
          console.log("  - heartRate:", hr);
          console.log("  - ablyStatus:", ablyStatus);
        }
      }

      if (connectedDeviceIdRef.current) {
        polarSdk
          .updateMonitorForegroundService(
            deviceLabel,
            hr,
            currentHrv > 0 ? currentHrv : 0,
            lf > 0 ? lf : 0,
            hf > 0 ? hf : 0
          )
          .catch(() => {});
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
    setRrMs(0);
    setRrSource(null);
    rrSourceRef.current = null;
    setOfflineRecordingStarted(false);
    sessionTrackBuffer.clear();

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
          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>Offline track:</ThemedText>
            <ThemedText style={styles.statusValue}>
              {offlineRecordingStarted
                ? "🟢 Polar PPI"
                : connectedDeviceId
                ? "🟠 Buffer live"
                : "🔴 Off"}
            </ThemedText>
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
            <View style={styles.metricsRow}>
              <View
                style={[
                  styles.metricCard,
                  styles.metricCardFull,
                  { borderColor: Colors[theme].border },
                ]}
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
            </View>

            <View style={styles.metricsRow}>
              <View
                style={[
                  styles.metricCard,
                  { borderColor: Colors[theme].border },
                ]}
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
                style={[
                  styles.metricCard,
                  { borderColor: Colors[theme].border },
                ]}
              >
                <View style={styles.metricIconContainer}>
                  <Activity size={24} color={Colors[theme].tint} />
                </View>
                <ThemedText style={styles.metricLabel}>RR</ThemedText>
                <ThemedText style={styles.metricValue}>
                  {connectedDeviceId && rrMs > 0 ? rrMs : "—"}
                </ThemedText>
                <ThemedText style={styles.metricUnit}>
                  {rrSource === "ppi"
                    ? "ms · PPI"
                    : rrSource === "hr_derived"
                    ? "ms · HR"
                    : "ms"}
                </ThemedText>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View
                style={[
                  styles.metricCard,
                  { borderColor: Colors[theme].border },
                ]}
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

              <View
                style={[
                  styles.metricCard,
                  { borderColor: Colors[theme].border },
                ]}
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
            </View>
          </View>
        </ThemedView>

        {/* Controlli */}
        <ThemedView style={styles.controlsSection}>
          {!connectedDeviceId ? (
            <>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.scanButton,
                  { backgroundColor: Colors[theme].tint },
                ]}
                onPress={startScan}
                disabled={isScanning || isConnectingSelected || !bluetoothPowered}
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

              {(discoveredDevices.length > 0 || isConnectingSelected) && (
                <ThemedView style={styles.discoveredList}>
                  <ThemedText style={styles.discoveredTitle}>
                    Seleziona un dispositivo
                  </ThemedText>
                  {isConnectingSelected && (
                    <View style={styles.connectingRow}>
                      <ActivityIndicator color={Colors[theme].tint} />
                      <ThemedText style={styles.connectingText}>
                        Connessione in corso…
                      </ThemedText>
                    </View>
                  )}
                  {discoveredDevices.map((device) => (
                    <TouchableOpacity
                      key={device.deviceId}
                      style={[
                        styles.discoveredItem,
                        { borderColor: Colors[theme].border },
                      ]}
                      onPress={() => selectAndConnect(device.deviceId)}
                      disabled={isConnectingSelected}
                    >
                      <View style={styles.discoveredItemText}>
                        <ThemedText style={styles.discoveredName}>
                          {device.name}
                        </ThemedText>
                        <View
                          style={[
                            styles.productBadge,
                            { backgroundColor: Colors[theme].tint },
                          ]}
                        >
                          <ThemedText style={styles.productBadgeText}>
                            {device.displayName}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText
                        style={[
                          styles.connectHint,
                          { color: Colors[theme].tint },
                        ]}
                      >
                        Connetti
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ThemedView>
              )}

              {foundDeviceName && discoveredDevices.length === 0 && (
                <ThemedView style={styles.successMessage}>
                  <ThemedText style={styles.successText}>
                    ✅ Trovato device {foundDeviceName} (
                    {getPolarProductBadge(foundDeviceName)})
                  </ThemedText>
                </ThemedView>
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
              {debugMode && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.flushButton,
                    { backgroundColor: Colors[theme].tint },
                  ]}
                  onPress={() => handleFlushTrack(null)}
                  disabled={isFlushingTrack}
                >
                  {isFlushingTrack ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.buttonText}>
                      Simula endSession / Flush track
                    </ThemedText>
                  )}
                </TouchableOpacity>
              )}
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
    gap: 12,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  metricCardFull: {
    flex: 1,
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
  discoveredList: {
    marginTop: 16,
    gap: 10,
  },
  discoveredTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  connectingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  connectingText: {
    fontSize: 14,
    opacity: 0.8,
  },
  discoveredItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  discoveredItemText: {
    flex: 1,
    marginRight: 12,
    gap: 8,
  },
  discoveredName: {
    fontSize: 15,
    fontWeight: "600",
  },
  productBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  productBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  connectHint: {
    fontSize: 14,
    fontWeight: "600",
  },
  connectedButtons: {
    width: "100%",
    gap: 10,
  },
  flushButton: {
    marginTop: 0,
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
