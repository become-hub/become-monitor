/**
 * Main Monitor Session Hook
 * Contains ALL MonitorScreen logic: state, effects, handlers for Polar/Muse devices
 */

import { useEffect, useRef, useState } from "react";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import { AblyService, ConnectionStatus } from "@/services/ably-service";
import { AuthService } from "@/services/auth-service";
import { calculateRMSSD, computeLfHf } from "@/services/hrv-calculator";
import { buildPolarAblyHeartRatePayload } from "@/services/polar-ably-payload";
import {
  PolarDeviceInfo,
  PolarEcgData,
  PolarHrData,
  PolarPpiData,
  PolarSkinTemperatureData,
  polarSdk,
} from "@/features/devices/polar/polar-ble-sdk";
import {
  ensurePolarReady,
  startPolarStreamingForProduct,
} from "@/features/devices/polar/polar-device-setup";
import {
  isSupportedPolarDevice,
  PolarProduct,
  resolvePolarProduct,
} from "@/features/devices/polar/polar-products";
import {
  MuseBandPowers,
  MuseDeviceInfo,
  MuseEegSample,
  museSdk,
} from "@/features/devices/muse/muse-ble-sdk";
import { startMuseStreamingForProduct } from "@/features/devices/muse/muse-device-setup";
import {
  isSupportedMuseDevice,
  MuseProduct,
  resolveMuseProduct,
} from "@/features/devices/muse/muse-products";
import { isMuseFamilyAvailable } from "@/constants/device-availability";
import { captureException, logToSentry } from "@/services/sentry";
import { resolveRrInterval, type RrSource } from "@/services/rr-interval";
import { sessionTrackBuffer } from "@/services/session-track-buffer";
import { StorageService, StoredAuthData } from "@/services/storage-service";
import {
  beginOfflineTrackForDevice,
  flushMonitorTrack,
} from "./use-session-track-flush";
import { createMonitorAblyService } from "./use-ably-live-session";
import {
  useScanStore,
  type DiscoveredDevice,
} from "@/stores/scan-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUserStore } from "@/stores/user-store";

const WINDOW_SIZE = 30;
const SCAN_TIMEOUT = 30000;

export type NotificationType = {
  type: "success" | "error";
  message: string;
} | null;

export function useMonitorSession() {
  // Stores
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

  const { debugMode, developerMode } = useSettingsStore();

  // Bluetooth & Device State
  const [bluetoothPowered, setBluetoothPowered] = useState(false);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string>("");
  const [foundDeviceName, setFoundDeviceName] = useState<string>("");
  const [isConnectingSelected, setIsConnectingSelected] = useState(false);
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);

  // Auth & Ably
  const authService = useRef(new AuthService());
  const ablyService = useRef<AblyService | null>(null);
  const userIdRef = useRef(0);
  const [ablyStatus, setAblyStatus] = useState<ConnectionStatus>(
    ConnectionStatus.DISCONNECTED
  );
  const [ablyPulseTick, setAblyPulseTick] = useState(0);

  const bumpAblyPulse = () => {
    setAblyPulseTick((tick) => tick + 1);
  };

  // Metrics - Polar
  const [heartRate, setHeartRate] = useState(0);
  const [hrv, setHrv] = useState(0);
  const [lfPower, setLfPower] = useState(0);
  const [hfPower, setHfPower] = useState(0);
  const [rrMs, setRrMs] = useState(0);
  const [rrSource, setRrSource] = useState<RrSource | null>(null);
  const [ecgMicroVolts, setEcgMicroVolts] = useState(0);
  const [skinTemperatureC, setSkinTemperatureC] = useState(0);
  /** True after we had live metrics and then lost contact / HR while still connected. */
  const [isSignalLost, setIsSignalLost] = useState(false);

  // Metrics - Muse
  const [connectedFamily, setConnectedFamily] = useState<"polar" | "muse" | null>(null);
  const [eegTp9, setEegTp9] = useState(0);
  const [eegAf7, setEegAf7] = useState(0);
  const [eegAf8, setEegAf8] = useState(0);
  const [eegTp10, setEegTp10] = useState(0);
  const [bandDelta, setBandDelta] = useState(0);
  const [bandTheta, setBandTheta] = useState(0);
  const [bandAlpha, setBandAlpha] = useState(0);
  const [bandBeta, setBandBeta] = useState(0);
  const [bandGamma, setBandGamma] = useState(0);
  const [museHr, setMuseHr] = useState(0);
  const [museBattery, setMuseBattery] = useState(0);

  // Refs
  const bandAlphaRef = useRef(0);
  const bandThetaRef = useRef(0);
  const bandBetaRef = useRef(0);
  const bandDeltaRef = useRef(0);
  const bandGammaRef = useRef(0);
  const connectedFamilyRef = useRef<"polar" | "muse" | null>(null);
  const [isFlushingTrack, setIsFlushingTrack] = useState(false);
  const [offlineRecordingStarted, setOfflineRecordingStarted] = useState(false);
  const heartRateRef = useRef(0);
  const hrvRef = useRef(0);
  const lfPowerRef = useRef(0);
  const hfPowerRef = useRef(0);
  const skinTemperatureCRef = useRef(0);
  const connectedDeviceNameRef = useRef("");
  const connectedDeviceIdRef = useRef<string | null>(null);
  const flushInFlightRef = useRef(false);
  const rrMsRef = useRef(0);
  const rrSourceRef = useRef<RrSource | null>(null);

  // Notification state
  const [notification, setNotification] = useState<NotificationType>(null);

  // PPI window & intervals
  const ppiWindow = useRef<number[]>([]);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const biometricInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const authStreamInFlightRef = useRef(false);
  const streamReadyDeviceRef = useRef<string | null>(null);
  /** Local PPI/HR/skin streams started (independent of Become auth / Ably). */
  const localStreamingDeviceRef = useRef<string | null>(null);
  const authSessionDeviceRef = useRef<string | null>(null);
  const pairingBlockedRef = useRef(false);
  const pendingPostFtuReconnectRef = useRef<string | null>(null);
  /** Debounce reset when device stays connected but leaves the wrist. */
  const signalLossTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPositiveSignalAtRef = useRef(0);
  const SIGNAL_LOSS_MS = 2500;

  // Derived state
  const connectedProduct: PolarProduct | null = resolvePolarProduct(connectedDeviceName);
  const connectedMuseProduct: MuseProduct | null = resolveMuseProduct(connectedDeviceName);
  const isH10Connected = connectedProduct?.id === "polar_h10";
  const isMuseConnected = connectedFamily === "muse" || connectedMuseProduct != null;
  const isSkinTemperatureSupported =
    !isMuseConnected &&
    connectedProduct?.capabilities.skinTemperatureUi === true;
  const showRawEcgCards =
    !isMuseConnected && connectedProduct?.capabilities.rawEcg === true;
  const titleDisplayName = isMuseConnected
    ? connectedMuseProduct?.displayName || "Muse 2"
    : connectedProduct?.displayName || "Polar Monitor";

  // Sync refs with state
  useEffect(() => { bandAlphaRef.current = bandAlpha; }, [bandAlpha]);
  useEffect(() => { bandThetaRef.current = bandTheta; }, [bandTheta]);
  useEffect(() => { bandBetaRef.current = bandBeta; }, [bandBeta]);
  useEffect(() => { bandDeltaRef.current = bandDelta; }, [bandDelta]);
  useEffect(() => { bandGammaRef.current = bandGamma; }, [bandGamma]);
  useEffect(() => { connectedFamilyRef.current = connectedFamily; }, [connectedFamily]);
  useEffect(() => { heartRateRef.current = heartRate; }, [heartRate]);
  useEffect(() => { hrvRef.current = hrv; }, [hrv]);
  useEffect(() => { lfPowerRef.current = lfPower; }, [lfPower]);
  useEffect(() => { hfPowerRef.current = hfPower; }, [hfPower]);
  useEffect(() => { skinTemperatureCRef.current = skinTemperatureC; }, [skinTemperatureC]);
  useEffect(() => { connectedDeviceNameRef.current = connectedDeviceName; }, [connectedDeviceName]);
  useEffect(() => { connectedDeviceIdRef.current = connectedDeviceId; }, [connectedDeviceId]);
  useEffect(() => { rrMsRef.current = rrMs; }, [rrMs]);
  useEffect(() => { rrSourceRef.current = rrSource; }, [rrSource]);

  // userId logging
  useEffect(() => {
    console.log(`Monitor: 🔍 userId changed to: ${userId} (type: ${typeof userId})`);
    userIdRef.current = userId;
  }, [userId]);

  // Auth notification
  useEffect(() => {
    if (authToken) {
      setNotification({
        type: "success",
        message: "Autenticato con successo!",
      });
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [authToken]);

  // Helper functions
  const setScanningState = (value: boolean) => {
    setScanning(value);
  };

  const ensureMonitorForegroundService = async () => {
    if (Platform.OS !== "android") return;
    try {
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
        const hasPermissions = await polarSdk.hasBluetoothPermissions();
        console.log(`Monitor: 🔐 Permessi concessi: ${hasPermissions}`);

        if (!hasPermissions) {
          console.log("Monitor: 🔐 Permessi non concessi, richiedo...");
          try {
            await polarSdk.requestBluetoothPermissions();
            console.log("Monitor: 🔐 Richiesta permessi inviata");
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
            console.error("Monitor: Errore nella richiesta permessi:", permissionError);
            Alert.alert("Errore", "Impossibile richiedere i permessi: " + permissionError.message);
            return false;
          }
        } else {
          console.log("Monitor: ✅ Permessi già concessi");
        }
        return true;
      } catch (error: any) {
        console.error("Monitor: Errore richiesta permessi:", error);
        Alert.alert("Errore", "Impossibile richiedere i permessi Bluetooth: " + error.message);
        return false;
      }
    }
    return true;
  };

  const handlePpiData = (data: PolarPpiData) => {
    console.log(`Monitor: 🔬 Elaborazione ${data.samples.length} campioni PPI`);

    data.samples.forEach((sample) => {
      const ppiMs = sample.ppi;

      if (sample.blocker || ppiMs < 300 || ppiMs > 2000) {
        console.log(
          `Monitor: ⚠️ Filtrato PPI` +
            (sample.blocker ? " (blocker)" : ` fuori range: ${ppiMs}ms`)
        );
        noteMissingSignal();
        return;
      }

      notePositiveSignal();
      if (sample.hr > 0) {
        setHeartRate(sample.hr);
        heartRateRef.current = sample.hr;
      }

      const resolved = resolveRrInterval({
        ppiMs,
        hrBpm: sample.hr > 0 ? sample.hr : heartRateRef.current,
      });
      if (resolved) {
        setRrMs(resolved.rrMs);
        setRrSource(resolved.rrSource);
        rrMsRef.current = resolved.rrMs;
        rrSourceRef.current = resolved.rrSource;
      }
      sessionTrackBuffer.pushPpi({
        ppiMs,
        hr: sample.hr > 0 ? sample.hr : undefined,
        errorEstimate: sample.errorEstimate,
        blockerBit: sample.blocker,
      });

      ppiWindow.current.push(ppiMs);
      if (ppiWindow.current.length > WINDOW_SIZE) {
        ppiWindow.current.shift();
      }

      console.log(`Monitor: 📈 Finestra PPI: ${ppiWindow.current.length}/${WINDOW_SIZE} campioni`);

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

        console.log(`Monitor: 📊 HRV=${roundedRmsdd}ms, LF=${roundedLf}, HF=${roundedHf}`);
      }

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
          console.log("✅ TUTTE LE CONDIZIONI SODDISFATTE - Invio dati ad Ably");
          const timestamp = new Date().toISOString();
          ablyService.current.sendMessage(
            userStateHRV.userId,
            "heartRate",
            buildPolarAblyHeartRatePayload({
              deviceId: connectedDeviceId,
              hr: heartRate,
              hrv: hrvValue,
              lfPower: lfPowerValue,
              hfPower: hfPowerValue,
              rrMs: resolved?.rrMs ?? null,
              rrSource: resolved?.rrSource ?? null,
              ppiMs: resolved?.rrSource === "ppi" ? ppiMs : null,
              skinTemperatureC: skinTemperatureCRef.current,
              date: timestamp,
              hrField: "heartRate",
            }),
            userStateHRV.deviceCode
          );
          bumpAblyPulse();
        } else {
          console.log("❌ CONDIZIONI NON SODDISFATTE - Non invio dati ad Ably");
        }
      }
    });
  };

  const beginOfflineTrack = async (
    deviceId: string,
    product?: PolarProduct | null
  ) => {
    await beginOfflineTrackForDevice(
      deviceId,
      product,
      connectedDeviceNameRef.current,
      setOfflineRecordingStarted,
      setNotification
    );
  };

  const handleFlushTrack = async (sessionId?: string | null) => {
    await flushMonitorTrack({
      deviceId: connectedDeviceIdRef.current,
      connectedDeviceName: connectedDeviceNameRef.current,
      sessionId,
      flushInFlightRef,
      setIsFlushingTrack,
      setOfflineRecordingStarted,
      setNotification,
    });
  };

  const launchAuthAndStream = async (
    deviceId: string,
    deviceName?: string,
    family: "polar" | "muse" = "polar"
  ) => {
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
      const name = deviceName ?? connectedDeviceNameRef.current;
      const museProduct = resolveMuseProduct(name);
      const polarProduct = resolvePolarProduct(name);
      const isMuse = family === "muse" || museProduct != null;

      if (!isMuse) {
        console.log("🩺 Verifica First Time Use...");
        const requireFtu = polarProduct?.capabilities.ftuRequired !== false;
        const polarReady = await ensurePolarReady(deviceId, polarSdk, { requireFtu });
        if (polarReady.status === "deferred") {
          console.log("✅ First Time Use ok (restart pending)");
          pendingPostFtuReconnectRef.current = deviceId;
          authSessionDeviceRef.current = null;
          setNotification({
            type: "success",
            message: "Polar configurato — riavvio in corso. Ricollega se non riparte da solo.",
          });
          setTimeout(() => setNotification(null), 8000);
          return;
        }
        if (polarReady.status === "failed") {
          console.error("Monitor: ❌ FTU fallito:", polarReady.error);
          authSessionDeviceRef.current = null;
          setNotification({
            type: "error",
            message: "Configura Polar 360 fallita — reset di fabbrica se già abbinato altrove",
          });
          setTimeout(() => setNotification(null), 8000);
          return;
        }
        console.log("✅ First Time Use ok");
      } else {
        console.log("🧠 Muse: skip FTU");
      }

      const startDeviceStreaming = async () => {
        if (localStreamingDeviceRef.current === deviceId) {
          console.log("Monitor: streaming locale già avviato per", deviceId);
          return;
        }
        if (isMuse && museProduct) {
          await startMuseStreamingForProduct(museProduct, museSdk);
          localStreamingDeviceRef.current = deviceId;
        } else if (isMuse && !museProduct) {
          console.warn("Monitor: Muse product non risolto per", name);
          logToSentry("Muse product unresolved", "warn", {
            deviceFamily: "muse",
            deviceName: name ?? "",
          });
        } else if (polarProduct) {
          await startPolarStreamingForProduct(polarProduct, deviceId, polarSdk);
          localStreamingDeviceRef.current = deviceId;
        }
      };

      // Local metrics (PPI / skin temp) must not wait for Become auth — HR already
      // arrives via BLE notifications; streams need an explicit SDK start.
      console.log("💓 Avvio streaming device (locale, indipendente da auth)...");
      await startDeviceStreaming();

      const storedAuthData = await StorageService.getAuthDataForDevice(deviceId);

      if (storedAuthData && storedAuthData.deviceToken) {
        console.log("Monitor: 🔍 Token salvato trovato, validazione...");

        const pollResponse = await authService.current.pollDeviceAuth(
          storedAuthData.deviceToken
        );

        if (pollResponse && pollResponse.authenticated === true) {
          console.log("Monitor: ✅ Token valido, utilizzo dati salvati");
          console.log("Monitor: 🔍 Stored data:", JSON.stringify(storedAuthData, null, 2));

          setAuthToken(storedAuthData.authToken);
          console.log(`Monitor: 🔍 Setting userId from stored data: ${storedAuthData.userId}`);
          setUserId(storedAuthData.userId);
          setDeviceCode(storedAuthData.deviceCode);
          if (storedAuthData.appId) {
            setAppId(storedAuthData.appId);
          }

          console.log("🔵 Connessione Ably con token salvato...");
          ablyService.current?.connectWithToken(
            storedAuthData.authToken,
            storedAuthData.userId,
            storedAuthData.deviceCode
          );

          // Streaming locale già avviato post-FTU; qui solo Ably / track.
          await startDeviceStreaming();

          startBiometricSending();
          streamReadyDeviceRef.current = deviceId;
          await ensureMonitorForegroundService();
          if (!isMuse) {
            await beginOfflineTrack(deviceId, polarProduct);
          }

          return;
        } else {
          console.log("Monitor: ❌ Token non valido, cancello dati salvati");
          await authService.current.clearAuthData(deviceId);
        }
      }

      const authFlow = await authService.current.startAuthFlow(deviceId);

      if (!authFlow.needsAuth && authFlow.storedData) {
        console.log("Monitor: ⚠️ Unexpected: needsAuth=false dopo validazione");
        return;
      }

      if (authFlow.newAuthResponse) {
        const authResponse = authFlow.newAuthResponse;
        setAuthCode(authResponse.code);
        console.log("Monitor: 🔑 Codice di autenticazione:", authResponse.code);
        console.log("Monitor: 🎫 Device token da salvare:", authResponse.deviceToken);

        await StorageService.saveDeviceTokenForDevice(deviceId, authResponse.deviceToken);
        console.log("Monitor: 🎫 Device token salvato nel storage");
      }

      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
      let pollHandlingAuth = false;
      pollInterval.current = setInterval(async () => {
        if (pollHandlingAuth || streamReadyDeviceRef.current === deviceId) {
          return;
        }
        const currentDeviceToken = await StorageService.getDeviceTokenForDevice(deviceId);
        console.log("🔄 POLLING ATTIVO - deviceToken:", currentDeviceToken);

        if (currentDeviceToken) {
          console.log("🔄 POLLING ATTIVO - Chiamando pollDeviceAuth...");
          const pollResponse = await authService.current.pollDeviceAuth(currentDeviceToken);
          console.log("📥 POLL RESPONSE RAW:", pollResponse);

          if (pollResponse) {
            console.log("Monitor: 📥 Poll response:", JSON.stringify(pollResponse));

            if (pollResponse.authenticated) {
              if (pollHandlingAuth || streamReadyDeviceRef.current === deviceId) {
                return;
              }
              pollHandlingAuth = true;
              if (pollInterval.current) {
                clearInterval(pollInterval.current);
                pollInterval.current = null;
                console.log("⏸️ Polling fermato");
              }

              console.log("Monitor: 🟢 Autenticato! User ID:", pollResponse.userId);
              console.log("🔥 AUTENTICAZIONE COMPLETATA - Avvio setup...");

              const currentDeviceToken = await StorageService.getDeviceTokenForDevice(deviceId);

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
              console.log(`Monitor: 🔍 Setting userId from poll response: ${pollResponse.userId}`);
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

              await startDeviceStreaming();

              startBiometricSending();
              streamReadyDeviceRef.current = deviceId;
              await ensureMonitorForegroundService();
              if (!isMuse) {
                await beginOfflineTrack(deviceId, polarProduct);
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
    } finally {
      authStreamInFlightRef.current = false;
    }
  };

  const startBiometricSending = () => {
    if (biometricInterval.current) {
      clearInterval(biometricInterval.current);
    }

    biometricInterval.current = setInterval(() => {
      const userStateBiometric = useUserStore.getState();
      const hr = heartRateRef.current;
      const currentHrv = hrvRef.current;
      const lf = lfPowerRef.current;
      const hf = hfPowerRef.current;
      const deviceLabel =
        connectedDeviceNameRef.current || connectedDeviceIdRef.current || "Polar";

      // Watchdog: if HR events stop entirely while still connected, clear stale UI.
      if (
        connectedDeviceIdRef.current &&
        hr > 0 &&
        lastPositiveSignalAtRef.current > 0 &&
        Date.now() - lastPositiveSignalAtRef.current >= SIGNAL_LOSS_MS
      ) {
        clearLiveBiometricMetrics();
        return;
      }

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
        const isMuse = connectedFamilyRef.current === "muse";
        const currentRrMs = rrMsRef.current;
        const currentRrSource = rrSourceRef.current;
        ablyService.current.sendMessage(
          userStateBiometric.userId,
          "heartRate",
          isMuse
            ? {
                deviceId: connectedDeviceIdRef.current,
                deviceFamily: "muse",
                hr,
                alpha: bandAlphaRef.current || null,
                theta: bandThetaRef.current || null,
                beta: bandBetaRef.current || null,
                delta: bandDeltaRef.current || null,
                gamma: bandGammaRef.current || null,
                date: timestamp,
              }
            : buildPolarAblyHeartRatePayload({
                deviceId: connectedDeviceIdRef.current,
                hr,
                hrv: currentHrv,
                lfPower: lf,
                hfPower: hf,
                rrMs: currentRrMs,
                rrSource: currentRrSource,
                ppiMs: currentRrSource === "ppi" ? currentRrMs : null,
                skinTemperatureC: skinTemperatureCRef.current,
                date: timestamp,
              }),
          userStateBiometric.deviceCode
        );
        bumpAblyPulse();
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
          .updateMonitorForegroundService(deviceLabel, hr, currentHrv > 0 ? currentHrv : 0, lf > 0 ? lf : 0, hf > 0 ? hf : 0)
          .catch(() => {});
      }
    }, 1000);
  };

  const stopBiometricSending = () => {
    if (biometricInterval.current) {
      clearInterval(biometricInterval.current);
      biometricInterval.current = null;
      console.log("Monitor: ⏹️ Fermato invio periodico dati biometrici");
    }
  };

  const cancelSignalLossClear = () => {
    if (signalLossTimeoutRef.current) {
      clearTimeout(signalLossTimeoutRef.current);
      signalLossTimeoutRef.current = null;
    }
  };

  /** Clear live metrics while keeping the BLE connection (off-wrist / no contact). */
  const clearLiveBiometricMetrics = () => {
    cancelSignalLossClear();
    setHeartRate(0);
    heartRateRef.current = 0;
    setHrv(0);
    hrvRef.current = 0;
    setLfPower(0);
    lfPowerRef.current = 0;
    setHfPower(0);
    hfPowerRef.current = 0;
    setRrMs(0);
    rrMsRef.current = 0;
    setRrSource(null);
    rrSourceRef.current = null;
    setEcgMicroVolts(0);
    setSkinTemperatureC(0);
    skinTemperatureCRef.current = 0;
    setMuseHr(0);
    ppiWindow.current = [];
    setIsSignalLost(true);
    console.log("Monitor: 📭 Nessun segnale dal sensore — metriche resettate");
  };

  const notePositiveSignal = () => {
    cancelSignalLossClear();
    lastPositiveSignalAtRef.current = Date.now();
    setIsSignalLost(false);
    // Sliding silence watchdog: if no further valid samples arrive, clear UI.
    signalLossTimeoutRef.current = setTimeout(() => {
      signalLossTimeoutRef.current = null;
      if (heartRateRef.current > 0) {
        clearLiveBiometricMetrics();
      }
    }, SIGNAL_LOSS_MS);
  };

  const noteMissingSignal = () => {
    if (heartRateRef.current <= 0) {
      return;
    }
    // Keep any existing silence timer from the last valid beat; otherwise start one.
    if (signalLossTimeoutRef.current) {
      return;
    }
    signalLossTimeoutRef.current = setTimeout(() => {
      signalLossTimeoutRef.current = null;
      if (heartRateRef.current > 0) {
        clearLiveBiometricMetrics();
      }
    }, SIGNAL_LOSS_MS);
  };

  const resetDeviceState = () => {
    cancelSignalLossClear();
    lastPositiveSignalAtRef.current = 0;
    localStreamingDeviceRef.current = null;
    resetScanState();
    resetUserState();
    setHeartRate(0);
    setHrv(0);
    setLfPower(0);
    setHfPower(0);
    setRrMs(0);
    rrMsRef.current = 0;
    setRrSource(null);
    setEcgMicroVolts(0);
    setSkinTemperatureC(0);
    skinTemperatureCRef.current = 0;
    setIsSignalLost(false);
    setConnectedFamily(null);
    setEegTp9(0);
    setEegAf7(0);
    setEegAf8(0);
    setEegTp10(0);
    setBandDelta(0);
    setBandTheta(0);
    setBandAlpha(0);
    setBandBeta(0);
    setBandGamma(0);
    setMuseHr(0);
    setMuseBattery(0);
    rrSourceRef.current = null;
    setOfflineRecordingStarted(false);
    sessionTrackBuffer.clear();
    ppiWindow.current = [];
    console.log("Monitor: 🔄 Stato del dispositivo resettato");
  };

  const startScan = async () => {
    console.log("Monitor: 🔍 startScan chiamato");
    pairingBlockedRef.current = false;

    console.log("Monitor: 🔐 Controllo permessi...");
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log("Monitor: ❌ Permessi non concessi");
      return;
    }
    console.log("Monitor: ✅ Permessi concessi");

    const btState = await polarSdk.checkBluetoothState();
    console.log(`Monitor: Bluetooth stato: ${btState ? "ON" : "OFF"}`);

    if (!btState) {
      Alert.alert("Bluetooth disabilitato", "Vuoi attivare il Bluetooth?", [
        { text: "Annulla", style: "cancel" },
        {
          text: "Attiva",
          onPress: async () => {
            try {
              console.log("Monitor: 🔵 Tentativo attivazione Bluetooth...");
              await polarSdk.setBluetoothEnabled(true);
              console.log("Monitor: ✅ Bluetooth attivato");
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

    setDeviceFound(false);
    setFoundDeviceName("");
    clearDiscoveredDevices();
    setScanStartTime(Date.now());
    setScanningState(true);
    const museScanEnabled = isMuseFamilyAvailable();
    console.log(
      museScanEnabled
        ? "Monitor: 🔍 Avvio scansione Polar + Muse..."
        : "Monitor: 🔍 Avvio scansione Polar..."
    );

    try {
      const scanTasks: Promise<unknown>[] = [polarSdk.startScan()];
      if (museScanEnabled) {
        scanTasks.push(
          museSdk.startScan().catch((e) => {
            console.warn("Monitor: Muse scan non disponibile", e);
          })
        );
      }
      await Promise.all(scanTasks);

      setTimeout(async () => {
        const currentState = useScanStore.getState();
        if (currentState.isScanning) {
          await polarSdk.stopScan();
          if (museScanEnabled) {
            await museSdk.stopScan().catch(() => {});
          }
          setScanningState(false);
          console.log("Monitor: ⏱️ Timeout scansione completo");

          if (
            !currentState.deviceFoundDuringScan &&
            currentState.discoveredDevices.length === 0 &&
            !currentState.connectedDeviceId
          ) {
            console.log("Monitor: ⚠️ Nessun dispositivo trovato dopo timeout scansione - mostro alert");
            Alert.alert(
              "Difficoltà di connessione",
              museScanEnabled
                ? "Nessun Polar o Muse trovato. Prova a spegnere e riaccendere il Bluetooth, poi ripeti la ricerca."
                : "Nessun Polar trovato. Prova a spegnere e riaccendere il Bluetooth, poi ripeti la ricerca.",
              [{ text: "Chiudi", style: "cancel" }]
            );
          }
        }
      }, SCAN_TIMEOUT);
    } catch (error: any) {
      console.error("Monitor: Errore scansione:", error);
      setScanningState(false);
      Alert.alert("Errore", `Impossibile avviare la scansione: ${error.message}`);
    }
  };

  const selectAndConnect = async (deviceId: string, family?: "polar" | "muse") => {
    if (pairingBlockedRef.current || isConnectingSelected) {
      return;
    }
    const discovered = discoveredDevices.find((d) => d.deviceId === deviceId);
    const resolvedFamily = family || discovered?.family || "polar";
    console.log(`Monitor: 👆 Selezione device ${deviceId} (${resolvedFamily})`);
    setIsConnectingSelected(true);
    try {
      await polarSdk.stopScan();
      if (isMuseFamilyAvailable()) {
        await museSdk.stopScan().catch(() => {});
      }
      setScanningState(false);
      await StorageService.setLastDeviceId(deviceId);
      if (resolvedFamily === "muse") {
        if (!isMuseFamilyAvailable()) {
          throw new Error("Muse non disponibile in questa build");
        }
        await museSdk.connectToDevice(deviceId);
      } else {
        await polarSdk.connectToDevice(deviceId);
      }
    } catch (error: any) {
      setIsConnectingSelected(false);
      console.error("Monitor: Errore connessione selezionata:", error);
      Alert.alert("Errore", `Impossibile connettersi: ${error?.message || "sconosciuto"}`);
    }
  };

  const disconnectDevice = async () => {
    if (connectedDeviceId) {
      Alert.alert(
        "Disconnetti dispositivo",
        "Sei sicuro di voler disconnettere il dispositivo?",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Disconnetti",
            style: "destructive",
            onPress: async () => {
              try {
                if (connectedFamily === "muse") {
                  await museSdk.stopStreaming().catch(() => {});
                  await museSdk.disconnectFromDevice(connectedDeviceId);
                } else {
                  await polarSdk.disconnectFromDevice(connectedDeviceId);
                }
                setConnectedDeviceId(null);
                setConnectedDeviceIdInStore(null);
                setConnectedDeviceName("");
                setConnectedFamily(null);
                setFoundDeviceName("");
                setDeviceMenuOpen(false);
                if (pollInterval.current) {
                  clearInterval(pollInterval.current);
                }
                stopBiometricSending();
                polarSdk.stopMonitorForegroundService().catch(() => {});
                ablyService.current?.close();
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

  const resetAuthSessionForDevice = () => {
    if (!connectedDeviceId) {
      return;
    }
    const deviceId = connectedDeviceId;
    const deviceLabel = connectedProduct?.displayName || connectedDeviceName || deviceId;
    setDeviceMenuOpen(false);
    Alert.alert(
      "Reset auth token",
      `Cancellare il token di autenticazione solo per ${deviceLabel} e disconnettere il dispositivo?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await authService.current.clearAuthData(deviceId);
              setAuthToken("");
              setUserId(0);
              setDeviceCode("");
              setAuthCode("");
              console.log(`Monitor: 🗑️ Auth token resettato per device ${deviceId}`);

              try {
                await polarSdk.disconnectFromDevice(deviceId);
              } catch (disconnectError: any) {
                console.error("Monitor: Errore disconnessione dopo reset auth:", disconnectError?.message);
              }

              setConnectedDeviceId(null);
              setConnectedDeviceIdInStore(null);
              setConnectedDeviceName("");
              setFoundDeviceName("");
              setDeviceMenuOpen(false);
              if (pollInterval.current) {
                clearInterval(pollInterval.current);
                pollInterval.current = null;
              }
              stopBiometricSending();
              polarSdk.stopMonitorForegroundService().catch(() => {});
              ablyService.current?.close();
              resetDeviceState();

              Alert.alert("Reset completato", `Token cancellato per ${deviceLabel}. Dispositivo disconnesso.`);
            } catch (error: any) {
              console.error("Monitor: Errore reset auth token:", error?.message);
              Alert.alert("Errore", error?.message || "Impossibile resettare il token");
            }
          },
        },
      ]
    );
  };

  const getBluetoothStateText = () => {
    return bluetoothPowered ? "Acceso" : "Spento";
  };

  const getStreamingStatusText = () => {
    if (!connectedDeviceId) {
      return "Disconnesso";
    }
    if (ablyStatus === ConnectionStatus.CONNECTED) {
      if (heartRate > 0) {
        return "Connesso";
      }
      return "In attesa dati";
    }
    if (ablyStatus === ConnectionStatus.CONNECTING) {
      return "Connessione...";
    }
    return "Disconnesso";
  };

  const getDeviceStatusText = () => {
    if (connectedDeviceId && connectedDeviceName) {
      return connectedDeviceName;
    }
    return "Nessun device";
  };

  const isStreamingLive =
    !!connectedDeviceId &&
    ablyStatus === ConnectionStatus.CONNECTED &&
    heartRate > 0;

  const getDisconnectButtonLabel = () => {
    if (isMuseConnected) {
      const model = connectedMuseProduct?.displayName || "Muse 2";
      const id = (connectedDeviceId || "").slice(0, 12);
      return id ? `Disconnetti ${model} (${id})` : `Disconnetti ${model}`;
    }
    const model = connectedProduct?.displayName || "Device";
    const bleSuffix =
      connectedDeviceName
        ?.replace(/polar/gi, "")
        .replace(/loop/gi, "")
        .replace(/gen\s*2/gi, "")
        .replace(/360/gi, "")
        .replace(/h10/gi, "")
        .trim() || "";
    const id = (bleSuffix || connectedDeviceId || "").slice(0, 12);
    return id ? `Disconnetti ${model} (${id})` : `Disconnetti ${model}`;
  };

  // Main SDK event listeners effect
  useEffect(() => {
    console.log("Monitor: 🔵 Inizializzazione AblyService...");
    ablyService.current = createMonitorAblyService((status) => {
      setAblyStatus(status);
      console.log("Monitor: 🔵 Ably status:", status);
      console.log("Monitor: 🔵 AblyService instance:", !!ablyService.current);
    });

    console.log("Monitor: 🔵 AblyService inizializzato:", !!ablyService.current);

    ablyService.current.setEndSessionHandler((payload) => {
      console.log("Monitor: 📥 Ably endSession", payload);
      handleFlushTrack(payload?.sessionId ?? null);
    });

    const initializeBluetooth = async () => {
      const powered = await polarSdk.checkBluetoothState();
      console.log(`Monitor: Stato Bluetooth iniziale: ${powered ? "ON" : "OFF"}`);
      setBluetoothPowered(powered);

      if (powered) {
        const lastDeviceId = await StorageService.getLastDeviceId();
        const storedAuthData = lastDeviceId
          ? await StorageService.getAuthDataForDevice(lastDeviceId)
          : await StorageService.getAuthData();
        if (storedAuthData && storedAuthData.deviceId && !pairingBlockedRef.current) {
          console.log(
            `Monitor: Tentativo riconnessione a ${storedAuthData.deviceName || storedAuthData.deviceId}`
          );
          try {
            await polarSdk.connectToDevice(storedAuthData.deviceId);
          } catch {
            console.log("Monitor: Riconnessione diretta fallita, sarà necessario fare scansione");
          }
        }
      }
    };

    initializeBluetooth();

    // Polar SDK listeners
    polarSdk.addEventListener("onBluetoothStateChanged", (state) => {
      console.log(`Monitor: Bluetooth ${state.powered ? "ON" : "OFF"}`);
      setBluetoothPowered(state.powered);

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
              console.log("Monitor: ⚠️ Riconnessione dopo riaccensione Bluetooth fallita");
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
      const discovered: DiscoveredDevice = {
        deviceId: device.deviceId,
        name: device.name,
        family: "polar",
        productId: product.id,
        displayName: product.displayName,
      };
      upsertDiscoveredDevice(discovered);

      if (pendingPostFtuReconnectRef.current === device.deviceId) {
        console.log(`Monitor: 🔁 Post-FTU reconnect automatico a ${device.deviceId}`);
        pendingPostFtuReconnectRef.current = null;
        polarSdk.stopScan();
        if (isMuseFamilyAvailable()) {
          museSdk.stopScan().catch(() => {});
        }
        setScanningState(false);
        polarSdk.connectToDevice(device.deviceId);
      }
    });

    polarSdk.addEventListener("onDeviceConnected", (device: PolarDeviceInfo) => {
      console.log(`Monitor: ✅ Connesso a ${device.name}!`);
      setIsConnectingSelected(false);
      setConnectedDeviceId(device.deviceId);
      setConnectedDeviceIdInStore(device.deviceId);
      setConnectedDeviceName(device.name);
      setConnectedFamily("polar");
      setFoundDeviceName("");
      clearDiscoveredDevices();

      StorageService.setLastDeviceId(device.deviceId);
      StorageService.updateDeviceName(device.name, device.deviceId);
      StorageService.updateDeviceId(device.deviceId);

      if (
        pairingBlockedRef.current ||
        streamReadyDeviceRef.current === device.deviceId ||
        authSessionDeviceRef.current === device.deviceId ||
        authStreamInFlightRef.current
      ) {
        return;
      }

      launchAuthAndStream(device.deviceId, device.name, "polar");
    });

    polarSdk.addEventListener("onDeviceDisconnected", (device: PolarDeviceInfo) => {
      console.log("Monitor: ⚠️ Dispositivo disconnesso");

      const expectedFtuRestart = pendingPostFtuReconnectRef.current === device.deviceId;

      if (expectedFtuRestart) {
        setNotification({
          type: "success",
          message: "Polar riavviato dopo configurazione — riconnessione…",
        });
        polarSdk.startScan().catch(() => {});
        setScanningState(true);
      } else {
        setNotification({
          type: "error",
          message: `Dispositivo disconnesso`,
        });
        pendingPostFtuReconnectRef.current = null;
      }

      setTimeout(() => {
        setNotification(null);
      }, 5000);

      setConnectedDeviceId(null);
      setConnectedDeviceIdInStore(null);
      setConnectedDeviceName("");
      setFoundDeviceName("");
      setIsConnectingSelected(false);
      setDeviceMenuOpen(false);
      authStreamInFlightRef.current = false;
      streamReadyDeviceRef.current = null;
      authSessionDeviceRef.current = null;
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
      stopBiometricSending();
      polarSdk.stopMonitorForegroundService().catch(() => {});
      ablyService.current?.close();

      resetDeviceState();
      if (expectedFtuRestart) {
        setScanningState(true);
      }
    });

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
      console.log(
        `Monitor: 💓 HR=${data.hr} BPM` +
          (data.contactSupported
            ? ` contact=${data.contactDetected ? "yes" : "no"}`
            : "")
      );

      const noContact =
        data.contactSupported === true && data.contactDetected === false;
      if (noContact || data.hr <= 0) {
        // Keep last values briefly (anti-flicker), then clear so UI shows no signal.
        noteMissingSignal();
      } else {
        notePositiveSignal();
        setHeartRate(data.hr);
        heartRateRef.current = data.hr;
      }
      const hrForStream = data.hr > 0 ? data.hr : heartRateRef.current;

      const product = resolvePolarProduct(connectedDeviceNameRef.current);
      const nativeRrs = data.rrsMs?.filter((rr) => Number.isFinite(rr) && rr >= 300 && rr <= 2000);

      if (nativeRrs && nativeRrs.length > 0 && product?.capabilities.rawEcg) {
        nativeRrs.forEach((rr) => {
          const resolved = resolveRrInterval({
            ecgRrMs: rr,
            hrBpm: hrForStream > 0 ? hrForStream : undefined,
          });
          if (resolved) {
            setRrMs(resolved.rrMs);
            setRrSource(resolved.rrSource);
            rrMsRef.current = resolved.rrMs;
            rrSourceRef.current = resolved.rrSource;
          }
          sessionTrackBuffer.pushEcgRr({
            rrMs: rr,
            hr: hrForStream > 0 ? hrForStream : undefined,
          });
          ppiWindow.current.push(rr);
          if (ppiWindow.current.length > WINDOW_SIZE) {
            ppiWindow.current.shift();
          }
        });

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

          console.log(`Monitor: 📊 HRV (RR ECG)=${roundedRmsdd}ms, LF=${roundedLf}, HF=${roundedHf}`);
        }

        const userStateHr = useUserStore.getState();
        if (
          hrForStream > 0 &&
          userStateHr.authToken &&
          ablyService.current &&
          userStateHr.userId &&
          userStateHr.deviceCode
        ) {
          const timestamp = new Date().toISOString();
          ablyService.current.sendMessage(
            userStateHr.userId,
            "heartRate",
            buildPolarAblyHeartRatePayload({
              deviceId: connectedDeviceId,
              hr: hrForStream,
              hrv: hrvValue,
              lfPower: lfPowerValue,
              hfPower: hfPowerValue,
              rrMs: rrMsRef.current,
              rrSource: rrSourceRef.current,
              ppiMs: null,
              skinTemperatureC: skinTemperatureCRef.current,
              date: timestamp,
              hrField: "heartRate",
            }),
            userStateHr.deviceCode
          );
          bumpAblyPulse();
        }
        return;
      }

      if (data.hr > 0) {
        if (
          product?.capabilities.rawEcg ||
          rrSourceRef.current === "ppi" ||
          rrSourceRef.current === "ecg_rr"
        ) {
          return;
        }

        const approximateRR = Math.round(60000 / data.hr);
        const resolved = resolveRrInterval({ hrBpm: data.hr });
        if (resolved) {
          setRrMs(resolved.rrMs);
          setRrSource(resolved.rrSource);
          rrMsRef.current = resolved.rrMs;
          rrSourceRef.current = resolved.rrSource;
          sessionTrackBuffer.pushHr(data.hr);
        }

        ppiWindow.current.push(approximateRR);
        if (ppiWindow.current.length > WINDOW_SIZE) {
          ppiWindow.current.shift();
        }

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

          console.log(`Monitor: 📊 HRV (da HR)=${roundedRmsdd}ms, LF=${roundedLf}, HF=${roundedHf}`);
        }

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
            buildPolarAblyHeartRatePayload({
              deviceId: connectedDeviceId,
              hr: data.hr,
              hrv: hrvValue,
              lfPower: lfPowerValue,
              hfPower: hfPowerValue,
              rrMs: resolved?.rrMs ?? null,
              rrSource: resolved?.rrSource ?? null,
              ppiMs: null,
              skinTemperatureC: skinTemperatureCRef.current,
              date: timestamp,
              hrField: "heartRate",
            }),
            userStateHRFallback.deviceCode
          );
          bumpAblyPulse();
        } else {
          console.log("❌ HR FALLBACK - Condizioni non soddisfatte");
        }
      }
    });

    polarSdk.addEventListener("onPpiDataReceived", (data: PolarPpiData) => {
      console.log(`Monitor: 📊 PPI Data ricevuto - ${data.samples.length} samples`);
      handlePpiData(data);
    });

    polarSdk.addEventListener("onPpiStreamError", (error: any) => {
      console.log("Monitor: ⚠️ PPI Stream Error:", error.error);
      console.log("Monitor: 🔄 Modalità fallback attiva (HRV da HR)");
    });

    polarSdk.addEventListener("onEcgDataReceived", (data: PolarEcgData) => {
      console.log(`Monitor: 📈 ECG ${data.voltageUv} µV (${data.sampleCount} samples)`);
      setEcgMicroVolts(data.voltageUv);
    });

    polarSdk.addEventListener("onSkinTemperatureReceived", (data: PolarSkinTemperatureData) => {
      console.log(`Monitor: 🌡️ Skin temperature=${data.temperatureC.toFixed(1)} °C`);
      setSkinTemperatureC(data.temperatureC);
      skinTemperatureCRef.current = data.temperatureC;
    });

    polarSdk.addEventListener("onSkinTemperatureStreamError", (error: any) => {
      console.log("Monitor: ⚠️ Skin Temperature Stream Error:", error?.error);
    });

    polarSdk.addEventListener("onEcgStreamError", (error: any) => {
      console.log("Monitor: ⚠️ ECG Stream Error:", error.error);
    });

    // Muse SDK listeners (solo se famiglia Muse abilitata)
    if (isMuseFamilyAvailable()) {
      try {
        museSdk.addEventListener("onMuseDeviceFound", (device: MuseDeviceInfo) => {
          if (!isSupportedMuseDevice(device.name)) {
            return;
          }
          const product = resolveMuseProduct(device.name);
          if (!product) {
            return;
          }
          console.log(`Monitor: 📡 Muse trovato: ${device.name} (${device.deviceId})`);
          setDeviceFound(true);
          setFoundDeviceName(device.name);
          const discovered: DiscoveredDevice = {
            deviceId: device.deviceId,
            name: device.name,
            family: "muse",
            productId: product.id,
            displayName: product.displayName,
          };
          upsertDiscoveredDevice(discovered);
        });

        museSdk.addEventListener("onMuseDeviceConnected", (device: MuseDeviceInfo) => {
          console.log(`Monitor: ✅ Muse connesso a ${device.name}`);
          setIsConnectingSelected(false);
          setConnectedDeviceId(device.deviceId);
          setConnectedDeviceIdInStore(device.deviceId);
          setConnectedDeviceName(device.name);
          setConnectedFamily("muse");
          setFoundDeviceName("");
          clearDiscoveredDevices();
          StorageService.setLastDeviceId(device.deviceId);
          StorageService.updateDeviceName(device.name, device.deviceId);
          StorageService.updateDeviceId(device.deviceId);
          if (
            streamReadyDeviceRef.current === device.deviceId ||
            authSessionDeviceRef.current === device.deviceId ||
            authStreamInFlightRef.current
          ) {
            return;
          }
          launchAuthAndStream(device.deviceId, device.name, "muse");
        });

        museSdk.addEventListener("onMuseDeviceDisconnected", (_device: MuseDeviceInfo) => {
          console.log("Monitor: ⚠️ Muse disconnesso");
          setNotification({
            type: "error",
            message: "Dispositivo disconnesso",
          });
          setTimeout(() => setNotification(null), 5000);
          setConnectedDeviceId(null);
          setConnectedDeviceIdInStore(null);
          setConnectedDeviceName("");
          setConnectedFamily(null);
          setFoundDeviceName("");
          setIsConnectingSelected(false);
          authStreamInFlightRef.current = false;
          streamReadyDeviceRef.current = null;
          authSessionDeviceRef.current = null;
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
          }
          stopBiometricSending();
          polarSdk.stopMonitorForegroundService().catch(() => {});
          ablyService.current?.close();
          resetDeviceState();
        });

        museSdk.addEventListener("onMuseEegSample", (data: MuseEegSample) => {
          setEegTp9(data.tp9);
          setEegAf7(data.af7);
          setEegAf8(data.af8);
          setEegTp10(data.tp10);
        });

        museSdk.addEventListener("onMuseBandPowers", (data: MuseBandPowers) => {
          setBandDelta(data.delta);
          setBandTheta(data.theta);
          setBandAlpha(data.alpha);
          setBandBeta(data.beta);
          setBandGamma(data.gamma);
        });

        museSdk.addEventListener("onMuseHeartRate", (data) => {
          if (data.hr > 0) {
            notePositiveSignal();
            setMuseHr(data.hr);
            setHeartRate(data.hr);
            heartRateRef.current = data.hr;
          } else {
            noteMissingSignal();
          }
        });

        museSdk.addEventListener("onMuseTelemetry", (data) => {
          setMuseBattery(data.batteryPercent);
        });

        museSdk.addEventListener("onMuseStreamError", (error) => {
          console.log("Monitor: ⚠️ Muse stream error:", error.error);
          logToSentry("Muse stream error", "error", {
            deviceFamily: "muse",
            error: error.error ?? "unknown",
          });
        });
      } catch (e) {
        console.warn("Monitor: MuseBleModule non disponibile", e);
        captureException(e, {
          deviceFamily: "muse",
          phase: "muse_module_init",
        });
      }
    }

    return () => {
      polarSdk.stopScan();
      if (isMuseFamilyAvailable()) {
        museSdk.stopScan().catch(() => {});
      }
      if (connectedDeviceId) {
        polarSdk.disconnectFromDevice(connectedDeviceId);
        if (isMuseFamilyAvailable()) {
          museSdk.disconnectFromDevice(connectedDeviceId).catch(() => {});
        }
      }
      polarSdk.removeAllListeners();
      if (isMuseFamilyAvailable()) {
        museSdk.removeAllListeners();
      }
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      cancelSignalLossClear();
      stopBiometricSending();
      polarSdk.stopMonitorForegroundService().catch(() => {});
      ablyService.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developerMode]);

  return {
    // Scan state
    isScanning,
    discoveredDevices,
    foundDeviceName,
    isConnectingSelected,

    // Device state
    bluetoothPowered,
    connectedDeviceId,
    connectedDeviceName,
    connectedFamily,
    connectedProduct,
    connectedMuseProduct,
    isH10Connected,
    isMuseConnected,
    isSkinTemperatureSupported,
    showRawEcgCards,
    titleDisplayName,
    deviceMenuOpen,
    setDeviceMenuOpen,

    // Auth state
    authToken,
    authCode,
    userId,
    deviceCode,
    appId,
    ablyStatus,
    ablyPulseTick,
    isStreamingLive,

    // Metrics - Polar
    heartRate,
    hrv,
    lfPower,
    hfPower,
    rrMs,
    rrSource,
    ecgMicroVolts,
    skinTemperatureC,
    isSignalLost,
    ppiWindowLength: ppiWindow.current.length,

    // Metrics - Muse
    eegTp9,
    eegAf7,
    eegAf8,
    eegTp10,
    bandDelta,
    bandTheta,
    bandAlpha,
    bandBeta,
    bandGamma,
    museHr,
    museBattery,

    // Track state
    isFlushingTrack,
    offlineRecordingStarted,

    // Notification
    notification,
    setNotification,

    // Actions
    startScan,
    selectAndConnect,
    disconnectDevice,
    clearStoredAuth,
    resetAuthSessionForDevice,
    handleFlushTrack,

    // Getters
    getBluetoothStateText,
    getStreamingStatusText,
    getDeviceStatusText,
    getDisconnectButtonLabel,

    // Debug mode
    debugMode,
  };
}
