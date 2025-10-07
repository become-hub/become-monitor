/**
 * Monitor Tab
 * Migrazione del codice legacy per il monitoraggio cardiaco Polar
 */

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AblyService, ConnectionStatus } from "@/services/ably-service";
import { AuthService } from "@/services/auth-service";
import { calculateRMSSD, computeLfHf } from "@/services/hrv-calculator";
import {
  PolarDeviceInfo,
  PolarHrData,
  PolarPpiData,
  polarSdk,
} from "@/services/polar-ble-sdk";
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
  const colorScheme = useColorScheme();

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
  const [deviceToken, setDeviceToken] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [userId, setUserId] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
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

  useEffect(() => {
    // Inizializza Ably service
    ablyService.current = new AblyService(
      "https://production-api25.become-hub.com/services/ably",
      (status) => {
        setAblyStatus(status);
        console.log("Monitor: 🔵 Ably status:", status);
      }
    );

    // Controlla stato Bluetooth iniziale
    polarSdk.checkBluetoothState().then((powered) => {
      console.log(
        `Monitor: 📱 Stato Bluetooth iniziale: ${powered ? "ON" : "OFF"}`
      );
      setBluetoothPowered(powered);
    });

    // Setup Polar SDK event listeners
    polarSdk.addEventListener("onBluetoothStateChanged", (state) => {
      console.log(`Monitor: Bluetooth ${state.powered ? "ON" : "OFF"}`);
      setBluetoothPowered(state.powered);
    });

    polarSdk.addEventListener("onDeviceFound", (device: PolarDeviceInfo) => {
      console.log(`Monitor: 📡 Trovato: ${device.name} (${device.deviceId})`);
      // Connetti automaticamente al primo Polar trovato
      polarSdk.stopScan();
      setIsScanning(false);
      polarSdk.connectToDevice(device.deviceId);
    });

    polarSdk.addEventListener(
      "onDeviceConnected",
      (device: PolarDeviceInfo) => {
        console.log(`Monitor: ✅ Connesso a ${device.name}!`);
        setConnectedDeviceId(device.deviceId);
        setConnectedDeviceName(device.name);
        // Avvia autenticazione e streaming
        launchAuthAndStream(device.deviceId);
      }
    );

    polarSdk.addEventListener(
      "onDeviceDisconnected",
      (device: PolarDeviceInfo) => {
        console.log("Monitor: ⚠️ Dispositivo disconnesso");
        setConnectedDeviceId(null);
        setConnectedDeviceName("");
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
        ablyService.current?.close();
      }
    );

    polarSdk.addEventListener("onHeartRateReceived", (data: PolarHrData) => {
      console.log(`Monitor: 💓 HR=${data.hr} BPM`);
      setHeartRate(data.hr);

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
      ablyService.current?.close();
    };
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

    try {
      await polarSdk.startScan();

      // Timeout scansione
      setTimeout(async () => {
        if (isScanning) {
          await polarSdk.stopScan();
          setIsScanning(false);
          console.log("Monitor: ⏱️ Timeout scansione");
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
      // Step 1: Autenticazione dispositivo
      let currentDeviceToken = deviceToken;

      if (authToken === "" || Math.floor(Date.now() / 1000) > expiresAt) {
        const authResponse = await authService.current.startDeviceAuth();
        if (authResponse) {
          currentDeviceToken = authResponse.deviceToken;
          setAuthCode(authResponse.code);
          setDeviceToken(authResponse.deviceToken);
          setExpiresAt(authResponse.expiresAt);
          console.log(
            "Monitor: 🔑 Codice di autenticazione:",
            authResponse.code
          );
          console.log(
            "Monitor: 🎫 Device token salvato:",
            authResponse.deviceToken
          );
        }
      }

      // Step 2: Polling per conferma autenticazione
      pollInterval.current = setInterval(async () => {
        console.log("🔄 POLLING ATTIVO - deviceToken:", currentDeviceToken);
        if (currentDeviceToken) {
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
              console.log(
                "Monitor: 🟢 Autenticato! User ID:",
                pollResponse.userId
              );
              console.log("🔥 AUTENTICAZIONE COMPLETATA - Avvio setup...");

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
          ablyService.current?.sendHeartRate(
            deviceCode,
            userId,
            heartRate,
            Math.round(rmssd),
            Math.round(lf),
            Math.round(hf)
          );
          console.log(`Monitor: 📤 Inviato HRV ad Ably`);
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
        ablyService.current?.close();
        console.log("Monitor: 🔌 Dispositivo disconnesso");
      } catch (error: any) {
        console.error("Monitor: Errore disconnessione:", error.message);
      }
    }
  };

  const getBluetoothStateText = () => {
    return bluetoothPowered ? "🟢 Acceso" : "🔴 Spento";
  };

  const getAblyStatusText = () => {
    switch (ablyStatus) {
      case ConnectionStatus.CONNECTED:
        return "🟢 Connesso";
      case ConnectionStatus.CONNECTING:
        return "🟡 Connessione...";
      default:
        return "🔴 Disconnesso";
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
            <ThemedText style={styles.statusLabel}>Streaming:</ThemedText>
            <ThemedText style={styles.statusValue}>
              {getAblyStatusText()}
            </ThemedText>
          </View>
          {authCode && (
            <View style={styles.authCodeContainer}>
              <ThemedText style={styles.authCodeLabel}>
                {authToken
                  ? "✅ Autenticato con successo!"
                  : "Inserisci questo codice sul PC:"}
              </ThemedText>
              {!authToken && (
                <ThemedText style={styles.authCode}>{authCode}</ThemedText>
              )}
            </View>
          )}
          {connectedDeviceId && (
            <View style={styles.statusRow}>
              <ThemedText style={styles.statusLabel}>Dispositivo:</ThemedText>
              <ThemedText style={styles.statusValue}>
                ✅ {connectedDeviceName}
              </ThemedText>
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
              style={[
                styles.metricCard,
                { borderColor: Colors[colorScheme ?? "light"].tint },
              ]}
            >
              <ThemedText style={styles.metricLabel}>Heart Rate</ThemedText>
              <ThemedText style={styles.metricValue}>
                {heartRate > 0 ? heartRate : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>BPM</ThemedText>
            </View>

            <View
              style={[
                styles.metricCard,
                { borderColor: Colors[colorScheme ?? "light"].tint },
              ]}
            >
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
              style={[
                styles.metricCard,
                { borderColor: Colors[colorScheme ?? "light"].tint },
              ]}
            >
              <ThemedText style={styles.metricLabel}>LF Power</ThemedText>
              <ThemedText style={styles.metricValue}>
                {lfPower > 0 ? lfPower : "—"}
              </ThemedText>
              <ThemedText style={styles.metricUnit}>ms²</ThemedText>
            </View>

            <View
              style={[
                styles.metricCard,
                { borderColor: Colors[colorScheme ?? "light"].tint },
              ]}
            >
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
            <TouchableOpacity
              style={[
                styles.button,
                styles.scanButton,
                { backgroundColor: Colors[colorScheme ?? "light"].tint },
              ]}
              onPress={startScan}
              disabled={isScanning || !bluetoothPowered}
            >
              {isScanning ? (
                <>
                  <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
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
        </ThemedView>

        {/* Info */}
        <ThemedView style={styles.infoSection}>
          <ThemedText style={styles.infoText}>
            💡 Questo monitor si connette ai dispositivi Polar (es. H10) per
            monitorare la frequenza cardiaca e calcolare le metriche HRV in
            tempo reale.
          </ThemedText>
          <ThemedText style={styles.infoText}>
            📊 Le metriche includono: HR, HRV (RMSSD), e analisi delle frequenze
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
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 14,
    opacity: 0.6,
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
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
