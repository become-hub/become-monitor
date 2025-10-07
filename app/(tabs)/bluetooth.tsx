import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import React, { useEffect, useState } from "react";
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

export default function BluetoothScreen() {
  const colorScheme = useColorScheme();
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Controlla lo stato del Bluetooth
    const subscription = bleManager.onStateChange((state) => {
      setBluetoothState(state);
      addLog(`Bluetooth state: ${state}`);

      if (state === State.PoweredOn) {
        addLog("Bluetooth è pronto!");
      }
    }, true);

    return () => {
      subscription.remove();
      bleManager.stopDeviceScan();
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      if (Platform.Version >= 31) {
        // Android 12+
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          addLog("Permessi Bluetooth negati");
          Alert.alert(
            "Permessi richiesti",
            "I permessi Bluetooth sono necessari per la scansione"
          );
          return false;
        }
      } else {
        // Android < 12
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Permesso Posizione",
            message: "Bluetooth Low Energy richiede il permesso di posizione",
            buttonPositive: "OK",
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          addLog("Permesso posizione negato");
          return false;
        }
      }
    }

    addLog("Permessi concessi");
    return true;
  };

  const startScan = async () => {
    if (bluetoothState !== State.PoweredOn) {
      Alert.alert(
        "Bluetooth disabilitato",
        "Abilita il Bluetooth per continuare"
      );
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setDevices([]);
    setIsScanning(true);
    addLog("Avvio scansione BLE...");

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        addLog(`Errore scansione: ${error.message}`);
        setIsScanning(false);
        return;
      }

      if (device && device.name) {
        setDevices((prevDevices) => {
          const exists = prevDevices.find((d) => d.id === device.id);
          if (!exists) {
            addLog(`Trovato: ${device.name} (${device.id})`);
            return [...prevDevices, device];
          }
          return prevDevices;
        });
      }
    });

    // Ferma la scansione dopo 10 secondi
    setTimeout(() => {
      stopScan();
    }, 10000);
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
    addLog("Scansione fermata");
  };

  const connectToDevice = async (device: Device) => {
    try {
      addLog(`Connessione a ${device.name}...`);

      const connected = await device.connect();
      setConnectedDevice(connected);
      addLog(`Connesso a ${device.name}!`);

      // Scopri i servizi e le caratteristiche
      const deviceWithServices =
        await connected.discoverAllServicesAndCharacteristics();
      const services = await deviceWithServices.services();

      addLog(`Servizi trovati: ${services.length}`);
      services.forEach((service) => {
        addLog(`  - Service UUID: ${service.uuid}`);
      });

      // Imposta un listener per la disconnessione
      device.onDisconnected((error, device) => {
        addLog(`Disconnesso da ${device?.name || "dispositivo"}`);
        setConnectedDevice(null);
      });
    } catch (error: any) {
      addLog(`Errore connessione: ${error.message}`);
      Alert.alert("Errore", `Impossibile connettersi: ${error.message}`);
    }
  };

  const disconnectDevice = async () => {
    if (connectedDevice) {
      try {
        await bleManager.cancelDeviceConnection(connectedDevice.id);
        addLog(`Disconnesso da ${connectedDevice.name}`);
        setConnectedDevice(null);
      } catch (error: any) {
        addLog(`Errore disconnessione: ${error.message}`);
      }
    }
  };

  const getBluetoothStateColor = () => {
    switch (bluetoothState) {
      case State.PoweredOn:
        return "#4CAF50";
      case State.PoweredOff:
        return "#F44336";
      default:
        return "#FF9800";
    }
  };

  const getBluetoothStateText = () => {
    switch (bluetoothState) {
      case State.PoweredOn:
        return "Acceso";
      case State.PoweredOff:
        return "Spento";
      case State.Unauthorized:
        return "Non autorizzato";
      case State.Unsupported:
        return "Non supportato";
      default:
        return "Sconosciuto";
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header con stato Bluetooth */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Bluetooth Low Energy
          </ThemedText>
          <View style={styles.stateContainer}>
            <View
              style={[
                styles.stateIndicator,
                { backgroundColor: getBluetoothStateColor() },
              ]}
            />
            <ThemedText style={styles.stateText}>
              Stato: {getBluetoothStateText()}
            </ThemedText>
          </View>
        </ThemedView>

        {/* Pulsanti di controllo */}
        <ThemedView style={styles.controlsContainer}>
          {!isScanning ? (
            <TouchableOpacity
              style={[
                styles.button,
                styles.scanButton,
                { backgroundColor: Colors[colorScheme ?? "light"].tint },
              ]}
              onPress={startScan}
              disabled={bluetoothState !== State.PoweredOn}
            >
              <ThemedText style={styles.buttonText}>
                Inizia Scansione
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={stopScan}
            >
              <ActivityIndicator
                color="#fff"
                style={styles.activityIndicator}
              />
              <ThemedText style={styles.buttonText}>Ferma Scansione</ThemedText>
            </TouchableOpacity>
          )}

          {connectedDevice && (
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

        {/* Lista dispositivi */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Dispositivi Trovati ({devices.length})
          </ThemedText>
          {devices.length === 0 ? (
            <ThemedView style={styles.emptyState}>
              <ThemedText style={styles.emptyText}>
                {isScanning
                  ? "Scansione in corso..."
                  : 'Nessun dispositivo trovato. Premi "Inizia Scansione"'}
              </ThemedText>
            </ThemedView>
          ) : (
            devices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={[
                  styles.deviceItem,
                  connectedDevice?.id === device.id &&
                    styles.deviceItemConnected,
                  { borderColor: Colors[colorScheme ?? "light"].tint },
                ]}
                onPress={() => connectToDevice(device)}
                disabled={!!connectedDevice}
              >
                <View style={styles.deviceInfo}>
                  <ThemedText style={styles.deviceName}>
                    {device.name || "Dispositivo Sconosciuto"}
                  </ThemedText>
                  <ThemedText style={styles.deviceId}>
                    ID: {device.id}
                  </ThemedText>
                  <ThemedText style={styles.deviceRssi}>
                    Segnale: {device.rssi} dBm
                  </ThemedText>
                </View>
                {connectedDevice?.id === device.id && (
                  <View
                    style={[
                      styles.connectedBadge,
                      { backgroundColor: Colors[colorScheme ?? "light"].tint },
                    ]}
                  >
                    <ThemedText style={styles.connectedText}>
                      CONNESSO
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ThemedView>

        {/* Log */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Log Attività
          </ThemedText>
          <ThemedView style={styles.logContainer}>
            {logs.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                Nessun log ancora
              </ThemedText>
            ) : (
              logs.map((log, index) => (
                <ThemedText key={index} style={styles.logText}>
                  {log}
                </ThemedText>
              ))
            )}
          </ThemedView>
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
    marginBottom: 10,
  },
  stateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  stateIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  stateText: {
    fontSize: 16,
  },
  controlsContainer: {
    padding: 20,
    gap: 10,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  scanButton: {
    // backgroundColor will be set dynamically
  },
  stopButton: {
    backgroundColor: "#F44336",
  },
  disconnectButton: {
    backgroundColor: "#FF9800",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  activityIndicator: {
    marginRight: 10,
  },
  section: {
    padding: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    marginBottom: 15,
  },
  emptyState: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    opacity: 0.6,
    textAlign: "center",
  },
  deviceItem: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deviceItemConnected: {
    borderWidth: 2,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  deviceRssi: {
    fontSize: 12,
    opacity: 0.7,
  },
  connectedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  connectedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  logContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 8,
    padding: 10,
    maxHeight: 300,
  },
  logText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 4,
  },
});
