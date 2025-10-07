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
import { Buffer } from "buffer";
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
import { BleManager, Device, State } from "react-native-ble-plx";

const bleManager = new BleManager();

// UUIDs standard per Heart Rate Service (Polar usa questi)
const HEART_RATE_SERVICE_UUID = "0000180D-0000-1000-8000-00805F9B34FB";
const HEART_RATE_CHARACTERISTIC_UUID = "00002A37-0000-1000-8000-00805F9B34FB";

// Dimensione finestra per HRV
const WINDOW_SIZE = 30; // ultimi 30 battiti (~30s)

export default function MonitorScreen() {
  const colorScheme = useColorScheme();

  // Bluetooth
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);

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
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Monitora stato Bluetooth
    const subscription = bleManager.onStateChange((state) => {
      setBluetoothState(state);
      if (state === State.PoweredOn) {
        console.log("Monitor: Bluetooth pronto!");
      }
    }, true);

    // Inizializza Ably service
    ablyService.current = new AblyService(
      "https://production-api25.become-hub.com/services/ably",
      (status) => {
        setAblyStatus(status);
        console.log("Monitor: 🔵 Ably status:", status);
      }
    );

    return () => {
      subscription.remove();
      bleManager.stopDeviceScan();
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
    if (bluetoothState !== State.PoweredOn) {
      Alert.alert("Bluetooth disabilitato", "Abilita il Bluetooth");
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsScanning(true);
    console.log("Monitor: 🔍 Avvio scansione Polar...");

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error("Monitor: Errore scansione:", error);
        setIsScanning(false);
        return;
      }

      // Cerca dispositivi Polar (o dispositivi con servizio HR)
      if (
        device &&
        device.name &&
        (device.name.toLowerCase().includes("polar") ||
          device.name.toLowerCase().includes("h10") ||
          device.name.toLowerCase().includes("h9"))
      ) {
        console.log(
          `Monitor: 📡 Trovato dispositivo Polar: ${device.name} (${device.id})`
        );
        bleManager.stopDeviceScan();
        setIsScanning(false);
        connectToDevice(device);
      }
    });

    // Timeout scansione
    setTimeout(() => {
      if (isScanning) {
        bleManager.stopDeviceScan();
        setIsScanning(false);
        console.log("Monitor: ⏱️ Timeout scansione");
      }
    }, 15000);
  };

  const connectToDevice = async (device: Device) => {
    try {
      console.log(`Monitor: 🔗 Connessione a ${device.name}...`);

      const connected = await device.connect();
      const deviceWithServices =
        await connected.discoverAllServicesAndCharacteristics();

      setConnectedDevice(deviceWithServices);
      console.log(`Monitor: ✅ Connesso a ${device.name}!`);

      // Imposta listener disconnessione
      device.onDisconnected((error) => {
        console.log("Monitor: ⚠️ Dispositivo disconnesso");
        setConnectedDevice(null);
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
        ablyService.current?.close();
      });

      // Avvia autenticazione e streaming
      launchAuthAndStream(deviceWithServices);
    } catch (error: any) {
      console.error("Monitor: Errore connessione:", error.message);
      Alert.alert("Errore", `Impossibile connettersi: ${error.message}`);
    }
  };

  const launchAuthAndStream = async (device: Device) => {
    try {
      // Step 1: Autenticazione dispositivo
      if (authToken === "" || Math.floor(Date.now() / 1000) > expiresAt) {
        const authResponse = await authService.current.startDeviceAuth();
        if (authResponse) {
          setAuthCode(authResponse.code);
          setDeviceToken(authResponse.deviceToken);
          setExpiresAt(authResponse.expiresAt);
          console.log(
            "Monitor: 🔑 Codice di autenticazione:",
            authResponse.code
          );
        }
      }

      // Step 2: Polling per conferma autenticazione
      pollInterval.current = setInterval(async () => {
        if (deviceToken) {
          const pollResponse = await authService.current.pollDeviceAuth(
            deviceToken
          );
          if (pollResponse && pollResponse.authenticated) {
            console.log(
              "Monitor: 🟢 Autenticato! User ID:",
              pollResponse.userId
            );
            setAuthToken(pollResponse.session);
            setUserId(parseInt(pollResponse.userId));
            setDeviceCode(pollResponse.deviceCode);

            // Connetti ad Ably
            ablyService.current?.connectWithToken(
              pollResponse.session,
              parseInt(pollResponse.userId),
              pollResponse.deviceCode
            );

            // Ferma il polling
            if (pollInterval.current) {
              clearInterval(pollInterval.current);
            }

            // Avvia monitoraggio HR
            startHeartRateMonitoring(device);
          } else {
            console.log("Monitor: ⏳ In attesa di autenticazione...");
          }
        }
      }, 5000);
    } catch (error) {
      console.error("Monitor: Errore autenticazione:", error);
    }
  };

  const startHeartRateMonitoring = async (device: Device) => {
    try {
      console.log("Monitor: 📊 Avvio monitoraggio HR...");

      // Monitora la caratteristica Heart Rate
      device.monitorCharacteristicForService(
        HEART_RATE_SERVICE_UUID,
        HEART_RATE_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error("Monitor: Errore HR monitoring:", error);
            return;
          }

          if (characteristic?.value) {
            const hrData = parseHeartRateData(characteristic.value);
            setHeartRate(hrData.bpm);

            // Calcola RR interval (approssimato da BPM se non disponibile)
            // I dispositivi Polar H10 inviano RR intervals nel payload
            if (hrData.rrIntervals.length > 0) {
              hrData.rrIntervals.forEach((rr) => {
                // Filtra valori implausibili
                if (rr < 300 || rr > 2000) return;

                // Aggiungi alla finestra PPI
                ppiWindow.current.push(rr);
                if (ppiWindow.current.length > WINDOW_SIZE) {
                  ppiWindow.current.shift();
                }

                // Calcola HRV quando la finestra è piena
                if (ppiWindow.current.length === WINDOW_SIZE) {
                  const rmssd = calculateRMSSD(ppiWindow.current);
                  setHrv(Math.round(rmssd));

                  // Calcola LF/HF
                  const { lf, hf } = computeLfHf(ppiWindow.current);
                  setLfPower(Math.round(lf));
                  setHfPower(Math.round(hf));

                  // Invia ad Ably
                  if (authToken && ablyStatus === ConnectionStatus.CONNECTED) {
                    ablyService.current?.sendHeartRate(
                      deviceCode,
                      userId,
                      hrData.bpm,
                      Math.round(rmssd),
                      Math.round(lf),
                      Math.round(hf)
                    );
                  }
                }
              });
            }
          }
        }
      );

      console.log("Monitor: ✅ Monitoraggio HR attivo!");
    } catch (error: any) {
      console.error("Monitor: Errore avvio monitoring:", error.message);
    }
  };

  const parseHeartRateData = (
    base64Value: string
  ): { bpm: number; rrIntervals: number[] } => {
    // Decodifica base64
    const buffer = Buffer.from(base64Value, "base64");

    // Flags byte
    const flags = buffer[0];
    const is16Bit = (flags & 0x01) !== 0;
    const hasRR = (flags & 0x10) !== 0;

    // Heart Rate Value
    let bpm = 0;
    let offset = 1;

    if (is16Bit) {
      bpm = buffer.readUInt16LE(offset);
      offset += 2;
    } else {
      bpm = buffer.readUInt8(offset);
      offset += 1;
    }

    // RR Intervals (se presenti)
    const rrIntervals: number[] = [];
    if (hasRR) {
      while (offset < buffer.length) {
        const rrValue = buffer.readUInt16LE(offset);
        // Converti in millisecondi (1/1024 sec -> ms)
        rrIntervals.push((rrValue / 1024) * 1000);
        offset += 2;
      }
    }

    return { bpm, rrIntervals };
  };

  const disconnectDevice = async () => {
    if (connectedDevice) {
      try {
        await bleManager.cancelDeviceConnection(connectedDevice.id);
        setConnectedDevice(null);
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
    switch (bluetoothState) {
      case State.PoweredOn:
        return "🟢 Acceso";
      case State.PoweredOff:
        return "🔴 Spento";
      default:
        return "⚪ Sconosciuto";
    }
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
          {authCode && !authToken && (
            <View style={styles.authCodeContainer}>
              <ThemedText style={styles.authCodeLabel}>
                Inserisci questo codice sul PC:
              </ThemedText>
              <ThemedText style={styles.authCode}>{authCode}</ThemedText>
            </View>
          )}
          {connectedDevice && (
            <View style={styles.statusRow}>
              <ThemedText style={styles.statusLabel}>Dispositivo:</ThemedText>
              <ThemedText style={styles.statusValue}>
                ✅ {connectedDevice.name}
              </ThemedText>
            </View>
          )}
        </ThemedView>

        {/* Metriche cardiache */}
        <ThemedView style={styles.metricsSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Metriche Cardiache
          </ThemedText>

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
              <ThemedText style={styles.metricUnit}>ms</ThemedText>
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
          {!connectedDevice ? (
            <TouchableOpacity
              style={[
                styles.button,
                styles.scanButton,
                { backgroundColor: Colors[colorScheme ?? "light"].tint },
              ]}
              onPress={startScan}
              disabled={isScanning || bluetoothState !== State.PoweredOn}
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
                Disconnetti {connectedDevice.name}
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
