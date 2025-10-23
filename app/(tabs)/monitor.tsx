/**
 * Monitor Tab
 * Migrazione del codice legacy per il monitoraggio cardiaco Polar
 */

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
import { Activity, Heart, Trash2, Zap } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
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

export default function MonitorScreen() {
  const { theme } = useTheme();

  // Bluetooth & Polar
  const [bluetoothPowered, setBluetoothPowered] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(
    null
  );
  const [connectedDeviceName, setConnectedDeviceName] = useState<string>("");

  // Auth & Ably
  const authService = useRef(new AuthService());
  const ablyService = useRef<AblyService | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [userId, setUserId] = useState(0);
  const [ablyStatus, setAblyStatus] = useState<ConnectionStatus>(
    ConnectionStatus.DISCONNECTED
  );

  // Metriche cardiache
  const [heartRate, setHeartRate] = useState(0);
  const [hrv, setHrv] = useState(0);
  const [lfPower, setLfPower] = useState(0);
  const [hfPower, setHfPower] = useState(0);

  // Finestra PPI per calcolo HRV
  const ppiWindow = useRef<number[]>([]);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const biometricInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Inizializza Ably service
    ablyService.current = new AblyService(
      "https://production-api25.become-hub.com/services/ably",
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
      if (ablyService.current && authToken && userId) {
        ablyService.current.sendMessage(
          userId,
          "bluetooth_state_changed",
          {
            powered: state.powered,
            status: state.powered ? "ON" : "OFF",
          },
          deviceCode
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

      // Invia evento dispositivo trovato ad Ably
      if (ablyService.current && authToken && userId) {
        ablyService.current.sendMessage(
          userId,
          "device_found",
          {
            deviceId: device.deviceId,
            deviceName: device.name,
            rssi: device.rssi,
          },
          deviceCode
        );
      }

      // Connetti automaticamente al primo Polar trovato
      polarSdk.stopScan();
      setIsScanning(false);

      // Invia evento di scansione fermata per dispositivo trovato ad Ably
      if (ablyService.current && authToken && userId) {
        ablyService.current.sendMessage(
          userId,
          "scan_stopped",
          {
            action: "scan_stopped",
            reason: "device_found",
            foundDevice: device.name,
          },
          deviceCode
        );
      }

      polarSdk.connectToDevice(device.deviceId);
    });

    polarSdk.addEventListener(
      "onDeviceConnected",
      (device: PolarDeviceInfo) => {
        console.log(`Monitor: ✅ Connesso a ${device.name}!`);
        setConnectedDeviceId(device.deviceId);
        setConnectedDeviceName(device.name);

        // Aggiorna il nome e l'ID del dispositivo nei dati salvati se esistono
        StorageService.updateDeviceName(device.name);
        StorageService.updateDeviceId(device.deviceId);

        // Invia evento di connessione ad Ably
        if (ablyService.current && authToken && userId) {
          ablyService.current.sendMessage(
            userId,
            "device_connected",
            {
              deviceId: device.deviceId,
              deviceName: device.name,
              rssi: device.rssi,
            },
            deviceCode
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

        // Invia evento di disconnessione ad Ably
        if (ablyService.current && authToken && userId) {
          ablyService.current.sendMessage(
            userId,
            "device_disconnected",
            {
              deviceId: device.deviceId,
              deviceName: device.name,
              reason: "disconnected",
            },
            deviceCode
          );
        }

        setConnectedDeviceId(null);
        setConnectedDeviceName("");
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
        stopBiometricSending();
        ablyService.current?.close();
      }
    );

    polarSdk.addEventListener("onHeartRateReceived", (data: PolarHrData) => {
      console.log(`Monitor: 💓 HR=${data.hr} BPM`);
      setHeartRate(data.hr);

      // Invia dati della frequenza cardiaca ad Ably (solo HR, HRV viene inviato separatamente quando calcolato)
      if (ablyService.current) {
        ablyService.current.sendMessage(
          userId,
          "heart_rate",
          {
            deviceId: data.deviceId,
            heartRate: data.hr,
            contactDetected: data.contactDetected,
            contactSupported: data.contactSupported,
            ppiWindowSize: ppiWindow.current.length,
          },
          deviceCode
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
          if (authToken && ablyStatus === ConnectionStatus.CONNECTED) {
            console.log(
              `Monitor: 🔍 Debug - userId: ${userId}, deviceCode: ${deviceCode}`
            );
            ablyService.current?.sendHeartRate(
              deviceCode,
              userId,
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
      if (ablyService.current && authToken && userId) {
        ablyService.current.sendMessage(
          userId,
          "ppi_data",
          {
            deviceId: data.deviceId,
            samples: data.samples,
            sampleCount: data.samples.length,
          },
          deviceCode
        );
      }

      handlePpiData(data);
    });

    polarSdk.addEventListener("onPpiStreamError", (error: any) => {
      console.log("Monitor: ⚠️ PPI Stream Error:", error.error);
      console.log("Monitor: 🔄 Modalità fallback attiva (HRV da HR)");

      // Invia errore PPI ad Ably
      if (ablyService.current && authToken && userId) {
        ablyService.current.sendMessage(
          userId,
          "ppi_stream_error",
          {
            error: error.error,
            message: "PPI stream error occurred",
            fallbackMode: true,
          },
          deviceCode
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

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            "Permessi richiesti",
            "I permessi Bluetooth sono necessari"
          );
          return false;
        }
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
      }
    }
    return true;
  };

  const startScan = async () => {
    if (!bluetoothPowered) {
      Alert.alert("Bluetooth disabilitato", "Abilita il Bluetooth");
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsScanning(true);
    console.log("Monitor: 🔍 Avvio scansione Polar...");

    // Invia evento di scansione avviata ad Ably
    if (ablyService.current && authToken && userId) {
      ablyService.current.sendMessage(
        userId,
        "scan_started",
        {
          action: "scan_started",
          timestamp: new Date().toISOString(),
        },
        deviceCode
      );
    }

    try {
      await polarSdk.startScan();

      // Timeout scansione
      setTimeout(async () => {
        if (isScanning) {
          await polarSdk.stopScan();
          setIsScanning(false);
          console.log("Monitor: ⏱️ Timeout scansione");

          // Invia evento di scansione timeout ad Ably
          if (ablyService.current && authToken && userId) {
            ablyService.current.sendMessage(
              userId,
              "scan_timeout",
              {
                action: "scan_timeout",
                reason: "timeout",
                duration: 15000,
              },
              deviceCode
            );
          }
        }
      }, 15000);
    } catch (error: any) {
      console.error("Monitor: Errore scansione:", error);
      setIsScanning(false);
      Alert.alert(
        "Errore",
        `Impossibile avviare la scansione: ${error.message}`
      );
    }
  };

  const launchAuthAndStream = async (deviceId: string) => {
    try {
      // Step 1: Controlla se abbiamo dati di autenticazione salvati
      const authFlow = await authService.current.startAuthFlow();

      if (!authFlow.needsAuth && authFlow.storedData) {
        // Usa i dati salvati
        console.log("Monitor: 🔄 Utilizzo dati di autenticazione salvati");
        const storedData = authFlow.storedData;

        setAuthToken(storedData.authToken);
        setUserId(storedData.userId);
        setDeviceCode(storedData.deviceCode);

        // Connetti ad Ably
        console.log("🔵 Connessione Ably con token salvato...");
        ablyService.current?.connectWithToken(
          storedData.authToken,
          storedData.userId,
          storedData.deviceCode
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
      }

      // Step 2: Nuovo flusso di autenticazione
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

      // Step 3: Polling per conferma autenticazione
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

              const authData: StoredAuthData = {
                authToken: pollResponse.session,
                userId: parseInt(pollResponse.userId),
                deviceCode: pollResponse.deviceCode,
                expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 ore
                deviceName: connectedDeviceName,
                deviceId: connectedDeviceId || undefined,
              };

              // Salva i dati di autenticazione
              await authService.current.saveAuthData(authData);

              setAuthToken(pollResponse.session);
              setUserId(parseInt(pollResponse.userId));
              setDeviceCode(pollResponse.deviceCode);

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
        if (authToken && ablyStatus === ConnectionStatus.CONNECTED) {
          console.log(
            `Monitor: 🔍 Debug PPI - userId: ${userId}, deviceCode: ${deviceCode}`
          );
          ablyService.current?.sendHeartRate(
            deviceCode,
            userId,
            heartRate,
            Math.round(rmssd),
            Math.round(lf),
            Math.round(hf)
          );

          // Invia evento completo con tutti i dati biometrici calcolati
          ablyService.current?.sendMessage(
            userId,
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
            deviceCode
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
      try {
        await polarSdk.disconnectFromDevice(connectedDeviceId);
        setConnectedDeviceId(null);
        setConnectedDeviceName("");
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
        stopBiometricSending();
        ablyService.current?.close();
        console.log("Monitor: 🔌 Dispositivo disconnesso");
      } catch (error: any) {
        console.error("Monitor: Errore disconnessione:", error.message);
      }
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

  const tryReconnectToSavedDevice = async () => {
    try {
      const storedAuthData = await StorageService.getAuthData();
      if (storedAuthData && storedAuthData.deviceId) {
        console.log(
          `Monitor: 🔄 Tentativo riconnessione manuale a ${
            storedAuthData.deviceName || storedAuthData.deviceId
          }`
        );
        await polarSdk.connectToDevice(storedAuthData.deviceId);
      } else {
        Alert.alert(
          "Nessun dispositivo salvato",
          "Non ci sono dispositivi salvati per la riconnessione."
        );
      }
    } catch (error: any) {
      console.error("Monitor: Errore riconnessione manuale:", error.message);
      Alert.alert(
        "Errore riconnessione",
        "Impossibile riconnettersi al dispositivo salvato. Prova a fare una scansione."
      );
    }
  };

  const startBiometricSending = () => {
    // Ferma il timer esistente se presente
    if (biometricInterval.current) {
      clearInterval(biometricInterval.current);
    }

    // Avvia invio periodico dei dati biometrici ogni secondo
    biometricInterval.current = setInterval(() => {
      if (ablyService.current && authToken && userId && heartRate > 0) {
        // Invia dati biometrici ogni secondo
        ablyService.current.sendMessage(
          userId,
          "biometric_data",
          {
            heartRate: heartRate,
            hrv: hrv,
            lfPower: lfPower,
            hfPower: hfPower,
            ppiWindowSize: ppiWindow.current.length,
            timestamp: new Date().toISOString(),
          },
          deviceCode
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

  const getBluetoothStateText = () => {
    return bluetoothPowered ? "🟢 Acceso" : "🔴 Spento";
  };

  const getStreamingStatusText = () => {
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
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Polar Monitor
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Monitoraggio cardiaco avanzato con HRV
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
          {authCode && (
            <View style={styles.authCodeContainer}>
              <ThemedText style={styles.authCodeLabel}>
                {authToken
                  ? "Autenticato con successo!"
                  : "Inserisci questo codice sul PC:"}
              </ThemedText>
              {!authToken && (
                <ThemedText style={styles.authCode}>{authCode}</ThemedText>
              )}
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
              style={[styles.metricCard, { borderColor: "rgba(0,0,0,0.1)" }]}
            >
              <View style={styles.metricIconContainer}>
                <Heart size={24} color={Colors[theme].tint} />
              </View>
              <ThemedText style={styles.metricLabel}>Heart Rate</ThemedText>
              <ThemedText style={styles.metricValue}>
                {heartRate > 0 ? heartRate : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>BPM</ThemedText>
            </View>

            <View
              style={[styles.metricCard, { borderColor: "rgba(0,0,0,0.1)" }]}
            >
              <View style={styles.metricIconContainer}>
                <Activity size={24} color={Colors[theme].tint} />
              </View>
              <ThemedText style={styles.metricLabel}>HRV (RMSSD)</ThemedText>
              <ThemedText style={styles.metricValue}>
                {hrv > 0 ? hrv : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>
                {hrv > 0
                  ? "ms"
                  : ppiWindow.current.length > 0
                  ? `${ppiWindow.current.length}/${WINDOW_SIZE}`
                  : "ms"}
              </ThemedText>
            </View>

            <View
              style={[styles.metricCard, { borderColor: "rgba(0,0,0,0.1)" }]}
            >
              <View style={styles.metricIconContainer}>
                <Zap size={24} color={Colors[theme].tint} />
              </View>
              <ThemedText style={styles.metricLabel}>LF Power</ThemedText>
              <ThemedText style={styles.metricValue}>
                {lfPower > 0 ? lfPower : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>ms²</ThemedText>
            </View>

            <View
              style={[styles.metricCard, { borderColor: "rgba(0,0,0,0.1)" }]}
            >
              <View style={styles.metricIconContainer}>
                <Zap size={24} color={Colors[theme].tint} />
              </View>
              <ThemedText style={styles.metricLabel}>HF Power</ThemedText>
              <ThemedText style={styles.metricValue}>
                {hfPower > 0 ? hfPower : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>ms²</ThemedText>
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
                  <ThemedText style={styles.buttonText}>
                    Cerca Dispositivo Polar
                  </ThemedText>
                )}
              </TouchableOpacity>

              {/* Pulsante riconnessione se abbiamo dati salvati */}
              {authToken && (
                <TouchableOpacity
                  style={[styles.button, styles.reconnectButton]}
                  onPress={tryReconnectToSavedDevice}
                  disabled={!bluetoothPowered}
                >
                  <ThemedText style={styles.buttonText}>
                    🔄 Riconnetti Dispositivo
                  </ThemedText>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={disconnectDevice}
            >
              <ThemedText style={styles.buttonText}>
                Disconnetti {connectedDeviceName}
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Pulsante per cancellare dati salvati */}
          {authToken && (
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
            Questo monitor si connette ai dispositivi Polar (es. H10) per
            monitorare la frequenza cardiaca e calcolare le metriche HRV in
            tempo reale.
          </ThemedText>
          <ThemedText style={styles.infoText}>
            Le metriche includono: HR, HRV (RMSSD), e analisi delle frequenze
            LF/HF per la variabilità cardiaca.
          </ThemedText>
        </ThemedView>
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
  clearButton: {
    backgroundColor: "#FF9800",
    marginTop: 10,
  },
  reconnectButton: {
    backgroundColor: "#2196F3",
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
