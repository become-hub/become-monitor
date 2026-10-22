/**
 * Main Monitor Session Hook
 * Contains ALL MonitorScreen logic: state, effects, handlers for Polar/Muse devices
 */

import { useEffect, useRef, useState } from "react";
import { Alert, PermissionsAndroid, Platform, Vibration } from "react-native";
import {
  AblyService,
  type AblySendStats,
  ConnectionStatus,
  EMPTY_ABLY_SEND_STATS,
} from "@/services/ably-service";
import { AuthService } from "@/services/auth-service";
import {
  calculateRMSSD,
  computeLfHf,
  computeLfHfProgress,
  isLfHfPublishable,
  lfHfQualityLevel,
  type LfHfProgress,
  type LfHfResult,
  type LfHfStatus,
} from "@/features/hrv/core/hrv-calculator";
import { APP_VERSION } from "@/constants/app-version";
import {
  EMPTY_POLAR_HR_EXTRAS,
  EMPTY_POLAR_PPI_EXTRAS,
  stashPolarHrExtras,
  stashPolarPpiExtras,
  type PolarHrExtrasStash,
  type PolarPpiExtrasStash,
} from "@/features/devices/polar/polar-signal-extras";
import {
  buildPolarHeartRateTick,
  buildPolarH10HeartRateTick,
} from "@/features/hrv/contract/build-tick";
import { buildPolarSessionEndPayload } from "@/features/hrv/contract/build-session-end";
import { buildPolarSessionMetaPayload } from "@/features/hrv/contract/build-session-meta";
import type { PolarContractDeviceModel } from "@/features/hrv/contract/types";
import {
  ackUpTo,
  bumpEpoch,
  createBeatOutbox,
  markInFlight,
  nackFrom,
  nextFrame,
  pushBeat,
  selectPending,
  type BeatOutbox,
} from "@/features/hrv/ppi/beat-outbox";
import {
  appendPpiSample,
  classifyPpiRejectReason,
  computeLfHfForPpiWindow,
  createEmptyPpiSampleWindow,
  HRV_PREPROCESSING_EXPORT,
  rejectReasonToKind,
  type PpiSampleWindow,
} from "@/features/hrv/ppi/ppi-sample-window";
import { isUsablePpiMs } from "@/features/hrv/ppi/ppi-limits";
import { buildWindowCheckpoint } from "@/features/hrv/ppi/window-checkpoint";
import {
  buildPolarSignalQualityUi,
  EMPTY_POLAR_SIGNAL_QUALITY,
  type PolarSignalQualityUi,
} from "./polar-live-signal";
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
import { isPolarReferenceCandidate } from "@/features/devices/polar/polar-reference-device";
import { referenceRecorder } from "@/features/hrv/reference/reference-recorder";
import { useReferenceStore } from "@/stores/reference-store";
import {
  isSupportedPolarDevice,
  PolarProduct,
  resolvePolarProduct,
  resolvePolarProductId,
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
import { resolveRrInterval, type RrSource } from "@/features/hrv/ppi/rr-interval";
import { sessionTrackBuffer } from "@/services/session-track-buffer";
import { StorageService, StoredAuthData } from "@/services/storage-service";
import {
  beginOfflineTrackForDevice,
  flushMonitorTrack,
} from "./use-session-track-flush";
import { createMonitorAblyService } from "./use-ably-live-session";
import {
  averageHrFromBucket,
  HR_ZERO_GRACE_MS,
  isFresh,
  isSustainedHrZero,
  POLAR_LIVE_TICK_MS,
  polarLiveIntervalMs,
  PPI_STALE_MS,
  PPI_STREAM_ALIVE_MS,
  shouldPublishLiveHeartRate,
} from "./polar-live-signal";
import {
  acceptHrvIntervalSample,
  beginNextClinicalEpoch,
  CLINICAL_ACQUISITION_TIMEOUT_MS,
  createEmptyHrvEpochAccumulator,
  formatDurationMmSs,
  formatHrvProgressLabel,
  getHrvAnalysisPolicy,
  hrvWallElapsedMs,
  isHrvAcquisitionTimedOut,
  markHrvAcquisitionStarted,
  pushHrvInterval,
  type HrvEpochAccumulator,
  type HrvIntervalSource,
} from "@/features/hrv/core/hrv-analysis-mode";
import {
  useScanStore,
  type DiscoveredDevice,
} from "@/stores/scan-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUserStore } from "@/stores/user-store";

const SCAN_TIMEOUT = 30000;
const QUALITY_PULSE_MS = 180;
const QUALITY_PULSE_GAP_MS = 140;

/** One pulse per quality level (1 low, 2 medium, 3 high). */
function vibrateQualityLevel(level: number) {
  if (level <= 0) return;
  const pattern = [0];
  for (let i = 0; i < level; i++) {
    if (i > 0) pattern.push(QUALITY_PULSE_GAP_MS);
    pattern.push(QUALITY_PULSE_MS);
  }
  Vibration.vibrate(pattern);
}

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

  const { debugMode, developerMode, authInvalidateNonce } = useSettingsStore();

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
  /** Heart-rate events acked by Ably in this BLE session (+ last one for the Monitor popup). */
  const [ablySendStats, setAblySendStats] = useState<AblySendStats>(
    EMPTY_ABLY_SEND_STATS
  );

  const bumpAblyPulse = () => {
    setAblyPulseTick((tick) => tick + 1);
  };

  const hrvAnalysisMode = useSettingsStore((s) => s.hrvAnalysisMode);

  // Metrics - Polar
  const [heartRate, setHeartRate] = useState(0);
  const [hrv, setHrv] = useState(0);
  const [lfPower, setLfPower] = useState(0);
  const [hfPower, setHfPower] = useState(0);
  const [lfHfStatus, setLfHfStatus] = useState<LfHfStatus>("unavailable");
  const [lfHfProgress, setLfHfProgress] = useState<LfHfProgress | null>(null);
  const [lfHfRatio, setLfHfRatio] = useState<number | null>(null);
  const [rrMs, setRrMs] = useState(0);
  const [rrSource, setRrSource] = useState<RrSource | null>(null);
  const [ecgMicroVolts, setEcgMicroVolts] = useState(0);
  const [skinTemperatureC, setSkinTemperatureC] = useState(0);
  /** True after we had live metrics and then lost contact / HR while still connected. */
  const [isSignalLost, setIsSignalLost] = useState(false);
  /**
   * True after the first valid Ably heartRate in this BLE session.
   * Once set, publish continues at 1 Hz until disconnect / logout / endSession.
   */
  const [ablyHeartRateLatched, setAblyHeartRateLatched] = useState(false);
  /** Live PPI/HR quality for compact Monitor cards + wear warning. */
  const [polarSignalQuality, setPolarSignalQuality] =
    useState<PolarSignalQualityUi>({ ...EMPTY_POLAR_SIGNAL_QUALITY });
  /** HRV window / clinical epoch progress for Monitor cards. */
  const [hrvEpochProgress, setHrvEpochProgress] = useState({
    intervalCount: 0,
    acceptedDurationMs: 0,
    wallElapsedMs: 0,
  });
  const [hrvEpochInvalid, setHrvEpochInvalid] = useState(false);

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
  /** Last PPI quality / skin contact for Ably extras. */
  const polarPpiExtrasRef = useRef<PolarPpiExtrasStash>({
    ...EMPTY_POLAR_PPI_EXTRAS,
  });
  /** Last BLE HR notification extras (ppgQuality / correctedHr / rrsMs). */
  const polarHrExtrasRef = useRef<PolarHrExtrasStash>({
    ...EMPTY_POLAR_HR_EXTRAS,
  });

  // Notification state
  const [notification, setNotification] = useState<NotificationType>(null);

  // HRV interval accumulator (client rolling window / clinical 5 min epoch) — RMSSD
  const hrvEpochRef = useRef<HrvEpochAccumulator>(createEmptyHrvEpochAccumulator());
  /** Rolling 5 min PPI window for LF/HF export (SDK samples only). */
  const ppiSampleWindowRef = useRef<PpiSampleWindow>(createEmptyPpiSampleWindow());
  /** Last LF/HF pipeline result (corrected + resampled series for Ably export). */
  const lastLfHfResultRef = useRef<LfHfResult | null>(null);
  const lfHfValidRef = useRef(false);
  const lfHfStatusRef = useRef<LfHfStatus>("unavailable");
  const lfHfRatioRef = useRef<number | null>(null);
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
  const hrZeroSinceRef = useRef(0);
  const hrZeroTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchGenRef = useRef(0);
  const lastValidPpiAtRef = useRef(0);
  /** HR samples since last Monitor/Ably flush (mean published at live rate). */
  const hrSumBucketRef = useRef(0);
  const hrCountBucketRef = useRef(0);
  const lastPolarLiveFlushAtRef = useRef(0);
  const lastPpiEventAtRef = useRef(0);
  /** Mirrors ablyHeartRateLatched for flush without waiting for render. */
  const ablyHeartRateLatchedRef = useRef(false);
  /** Wall-clock ms when the current stale (hr=0) Ably period started; 0 if not stale. */
  const signalStaleSinceRef = useRef(0);
  /** Ably delta beat outbox (survives PPI window resets). */
  const beatOutboxRef = useRef<BeatOutbox>(createBeatOutbox());
  /** Short session id linking ticks / sessionMeta / sessionEnd. */
  const ablySessionIdRef = useRef<string | null>(null);
  /** heartRate ticks published in this Ably session (for sessionEnd). */
  const ablyTickCountRef = useRef(0);
  /** True after sessionMeta has been sent for the current ep. */
  const sessionMetaSentForEpRef = useRef<number | null>(null);
  /** Publish windowCrc every N ticks. */
  const windowCrcTickCounterRef = useRef(0);
  const WINDOW_CRC_EVERY_N_TICKS = 30;

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

  const syncPolarSignalQualityUi = () => {
    setPolarSignalQuality(
      buildPolarSignalQualityUi(
        polarPpiExtrasRef.current,
        polarHrExtrasRef.current
      )
    );
  };

  const syncHrvEpochProgressUi = (nowMs: number = Date.now()) => {
    setHrvEpochProgress({
      intervalCount: hrvEpochRef.current.intervals.length,
      acceptedDurationMs: hrvEpochRef.current.acceptedDurationMs,
      wallElapsedMs: hrvWallElapsedMs(hrvEpochRef.current, nowMs),
    });
  };

  const clearHrvComputedMetrics = () => {
    setHrv(0);
    hrvRef.current = 0;
    setLfPower(0);
    lfPowerRef.current = 0;
    setHfPower(0);
    hfPowerRef.current = 0;
    lfHfValidRef.current = false;
    lfHfStatusRef.current = "unavailable";
    setLfHfStatus("unavailable");
    setLfHfProgress(null);
    lfHfRatioRef.current = null;
    setLfHfRatio(null);
    lastLfHfResultRef.current = null;
  };

  const resetPpiSampleWindow = () => {
    ppiSampleWindowRef.current = createEmptyPpiSampleWindow();
    lastLfHfResultRef.current = null;
    lfHfValidRef.current = false;
    lfHfStatusRef.current = "unavailable";
    setLfHfStatus("unavailable");
    setLfHfProgress(null);
    lfHfRatioRef.current = null;
    setLfHfRatio(null);
    // New epoch for Ably beats; pending outbox beats are kept until ack.
    beatOutboxRef.current = bumpEpoch(beatOutboxRef.current);
    sessionMetaSentForEpRef.current = null;
  };

  const ensureAblySessionId = (): string => {
    if (ablySessionIdRef.current == null) {
      ablySessionIdRef.current = Math.random().toString(36).slice(2, 10);
    }
    return ablySessionIdRef.current;
  };

  const publishSessionMetaIfNeeded = (
    userId: number,
    deviceCode: string | undefined
  ) => {
    if (!ablyService.current) return;
    const box = beatOutboxRef.current;
    if (sessionMetaSentForEpRef.current === box.ep) return;
    const sid = ensureAblySessionId();
    const productId = resolvePolarProductId(connectedDeviceNameRef.current);
    const meta = buildPolarSessionMetaPayload({
      sid,
      ep: box.ep,
      deviceId: connectedDeviceIdRef.current,
      deviceModel: (productId as PolarContractDeviceModel | null) ?? null,
      rrSource: rrSourceRef.current || null,
      contactStatusSupported:
        polarPpiExtrasRef.current.skinContactSupported ??
        polarHrExtrasRef.current.contactSupported ??
        null,
      hrvAnalysisMode: useSettingsStore.getState().hrvAnalysisMode,
      hrvPreprocessing: HRV_PREPROCESSING_EXPORT,
      appVersion: `v${APP_VERSION}`,
    });
    const metaEp = box.ep;
    // Marked as sent immediately (no duplicate per tick); reverted if Ably
    // drops/rejects it so the next tick re-publishes it.
    sessionMetaSentForEpRef.current = metaEp;
    ablyService.current
      .sendMessage(userId, "sessionMeta", meta, deviceCode)
      .then((ok) => {
        if (
          !ok &&
          ablySessionIdRef.current === sid &&
          sessionMetaSentForEpRef.current === metaEp
        ) {
          sessionMetaSentForEpRef.current = null;
        }
      });
  };

  const publishSessionEnd = (
    userId: number,
    deviceCode: string | undefined
  ) => {
    if (!ablyService.current || ablySessionIdRef.current == null) return;
    const box = beatOutboxRef.current;
    const end = buildPolarSessionEndPayload({
      sid: ablySessionIdRef.current,
      lastSeq: Math.max(0, box.nextSeq - 1),
      beatCount: Math.max(0, box.nextSeq - 1),
      epochs: box.ep,
      ticks: ablyTickCountRef.current,
    });
    ablyService.current.sendMessage(userId, "sessionEnd", end, deviceCode);
  };

  const resetHrvEpochAccumulator = (clearMetrics: boolean) => {
    hrvEpochRef.current = createEmptyHrvEpochAccumulator();
    resetPpiSampleWindow();
    setHrvEpochInvalid(false);
    if (clearMetrics) {
      clearHrvComputedMetrics();
    }
    syncHrvEpochProgressUi();
  };

  const handleClinicalAcquisitionTimeout = () => {
    console.log(
      "Monitor: ⏱️ Epoch estesa non valida (timeout acquisizione) — riparto"
    );
    hrvEpochRef.current = createEmptyHrvEpochAccumulator();
    resetPpiSampleWindow();
    setHrvEpochInvalid(true);
    clearHrvComputedMetrics();
    syncHrvEpochProgressUi();
    setNotification({
      type: "error",
      message:
        "Acquisizione estesa non riuscita: resta fermo e riprova (servono ~5 minuti di segnale stabile).",
    });
    setTimeout(() => setNotification(null), 6000);
  };

  /**
   * Recompute LF/HF from the rolling PPI window (SDK samples only).
   * Live 1 Hz only republishes this stash — it never appends PPI.
   */
  const recomputeLfHfFromPpiWindow = () => {
    const window = ppiSampleWindowRef.current;
    const result = {
      ...computeLfHfForPpiWindow(window),
      lfHfComputedAt: Date.now(),
    };
    lastLfHfResultRef.current = result;

    // Same gate as Ably heartRate: no LF/HF until RMSSD (Live 30 beats / clinical epoch).
    // Short windows at start inflate LF/HF; wait for a stable beat buffer.
    const hrvReady = hrvRef.current > 0;
    const status = hrvReady ? result.status : "unavailable";
    const shown = hrvReady && isLfHfPublishable(result.status);
    const roundedLf = shown ? Math.round(result.lf) : 0;
    const roundedHf = shown ? Math.round(result.hf) : 0;
    const ratio =
      shown && result.lfHfRatio != null
        ? Math.round(result.lfHfRatio * 1000) / 1000
        : null;

    if (hrvReady) {
      const previousLevel = lfHfQualityLevel(lfHfStatusRef.current);
      const nextLevel = lfHfQualityLevel(status);
      if (nextLevel > previousLevel) {
        vibrateQualityLevel(nextLevel);
      }
    }

    lfHfValidRef.current = shown && result.valid;
    lfHfStatusRef.current = status;
    lfHfRatioRef.current = ratio;
    lfPowerRef.current = roundedLf;
    hfPowerRef.current = roundedHf;
    setLfPower(roundedLf);
    setHfPower(roundedHf);
    setLfHfRatio(ratio);
    setLfHfStatus(status);
    setLfHfProgress(
      shown
        ? computeLfHfProgress({
            status: result.status,
            acceptedRatio: result.acceptedRatio,
            maxArtifactGapSec: result.maxArtifactGapSec,
            resampledDurationSec: result.resampledDurationSec,
          })
        : null
    );
    if (shown && result.valid) {
      setHrvEpochInvalid(false);
    }

    console.log(
      `HRV_PSD hrvReady=${hrvReady} rawPpiCount=${result.rawPpiCount} acceptedPpiCount=${result.acceptedPpiCount} ` +
        `rejectedPpiCount=${result.rejectedPpiCount} correctedPpiCount=${result.correctedPpiCount} ` +
        `timelineExcludedCount=${result.timelineExcludedCount} ` +
        `acceptedRatio=${result.acceptedRatio.toFixed(3)} ` +
        `maxArtifactGapSec=${result.maxArtifactGapSec.toFixed(2)} ` +
        `includedIntervalDurationSec=${result.includedIntervalDurationSec.toFixed(1)} ` +
        `tachogramDomainSec=${result.tachogramDomainSec.toFixed(1)} ` +
        `resampledDurationSec=${result.resampledDurationSec.toFixed(1)} ` +
        `resampledPointCount=${result.resampledPointCount} samplingHz=4 livePublishHz=1 ` +
        `method=periodogram ` +
        `lf=${shown ? result.lf.toFixed(1) : "0"} hf=${shown ? result.hf.toFixed(1) : "0"} ` +
        `lfHf=${ratio ?? "null"} peakFrequencyHz=${
          shown && result.peakFrequencyHz != null
            ? result.peakFrequencyHz.toFixed(3)
            : "null"
        } lfHfStatus=${status} lfHfValid=${shown && result.valid} lfHfComputedAt=${result.lfHfComputedAt}`
    );
  };

  /**
   * Accept + accumulate one RR/PPI interval for HRV/LF/HF per current analysis mode.
   */
  const ingestHrvInterval = (
    source: HrvIntervalSource,
    intervalMs: number,
    sample: {
      errorEstimate?: number | null;
      blocker?: boolean | null;
    } = {},
    logTag: string = "HRV"
  ) => {
    const mode = useSettingsStore.getState().hrvAnalysisMode;
    const policy = getHrvAnalysisPolicy(mode, source);
    const nowMs = Date.now();

    // Estesa: avvia il timer di acquisizione al primo campione (anche se scartato).
    if (mode === "clinical") {
      hrvEpochRef.current = markHrvAcquisitionStarted(
        hrvEpochRef.current,
        nowMs
      );
      if (
        isHrvAcquisitionTimedOut(
          hrvEpochRef.current,
          CLINICAL_ACQUISITION_TIMEOUT_MS,
          nowMs
        )
      ) {
        handleClinicalAcquisitionTimeout();
        return;
      }
    }

    if (
      !acceptHrvIntervalSample(mode, source, {
        intervalMs,
        errorEstimate: sample.errorEstimate,
        blocker: sample.blocker,
      })
    ) {
      if (source === "ppi") {
        console.log(
          `Monitor: ⏸️ PPI non accettato per ${mode} ` +
            `(errorEstimate=${sample.errorEstimate}, blocker=${sample.blocker}) — ` +
            `utile ${formatDurationMmSs(hrvEpochRef.current.acceptedDurationMs)} / ` +
            `trascorsi ${formatDurationMmSs(hrvWallElapsedMs(hrvEpochRef.current, nowMs))}`
        );
      }
      // Aggiorna comunque il timer di acquisizione in UI.
      syncHrvEpochProgressUi(nowMs);
      return;
    }

    const result = pushHrvInterval(
      hrvEpochRef.current,
      policy,
      intervalMs,
      nowMs
    );
    hrvEpochRef.current = result.accumulator;
    syncHrvEpochProgressUi(nowMs);

    if (result.epochTimedOut) {
      handleClinicalAcquisitionTimeout();
      return;
    }

    const progress = formatHrvProgressLabel(
      mode,
      result.accumulator.intervals.length,
      result.accumulator.acceptedDurationMs
    );
    console.log(`Monitor: 📈 Finestra ${logTag}: ${progress}`);

    if (!result.shouldCompute) {
      return;
    }

    // RMSSD stays on the Live 30-beat / clinical epoch window.
    // For PPI (360/Loop), LF/HF use the rolling 5 min window (recomputeLfHfFromPpiWindow).
    // For ECG RR / HR-derived, LF/HF still use this same epoch series.
    const series = result.accumulator.intervals;
    const rmssd = calculateRMSSD(series);
    const roundedRmsdd = Math.round(rmssd);
    hrvRef.current = roundedRmsdd;
    setHrv(roundedRmsdd);
    setHrvEpochInvalid(false);

    if (source !== "ppi") {
      // H10 / HR-derived: same physiological-timeline computeLfHf on epoch series.
      const { lf, hf } = computeLfHf(series);
      const roundedLf = Math.round(lf);
      const roundedHf = Math.round(hf);
      lfPowerRef.current = roundedLf;
      hfPowerRef.current = roundedHf;
      lfHfValidRef.current = roundedLf > 0 || roundedHf > 0;
      lfHfStatusRef.current = lfHfValidRef.current ? "valid" : "unavailable";
      lfHfRatioRef.current =
        hf > 0 ? Math.round((lf / hf) * 1000) / 1000 : null;
      lastLfHfResultRef.current = null;
      setLfPower(roundedLf);
      setHfPower(roundedHf);
      setLfHfRatio(lfHfRatioRef.current);
      setLfHfStatus(lfHfStatusRef.current);
      setLfHfProgress(null);
      console.log(
        `Monitor: 📊 HRV (${logTag})=${roundedRmsdd}ms, LF=${roundedLf}, HF=${roundedHf}`
      );
    } else {
      console.log(`Monitor: 📊 HRV (${logTag})=${roundedRmsdd}ms`);
    }

    if (mode === "clinical") {
      hrvEpochRef.current = beginNextClinicalEpoch();
      syncHrvEpochProgressUi();
    }
  };

  // Reset HRV epoch when analysis mode changes (keep HR / RR live).
  useEffect(() => {
    resetHrvEpochAccumulator(true);
    console.log(`Monitor: 🔄 Modalità HRV → ${hrvAnalysisMode}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mode change
  }, [hrvAnalysisMode]);

  const handlePpiData = (data: PolarPpiData) => {
    console.log(`Monitor: 🔬 Elaborazione ${data.samples.length} campioni PPI`);
    const frameNowMs = Date.now();
    lastPpiEventAtRef.current = frameNowMs;
    const mode = useSettingsStore.getState().hrvAnalysisMode;
    let appendedAny = false;

    beatOutboxRef.current = nextFrame(beatOutboxRef.current);

    data.samples.forEach((sample) => {
      const ppiMs = sample.ppi;
      polarPpiExtrasRef.current = stashPolarPpiExtras(sample);
      syncPolarSignalQualityUi();

      const rejectReason = classifyPpiRejectReason(mode, {
        ppiMs,
        errorEstimate: sample.errorEstimate,
        blocker: sample.blocker,
      });
      const kind = rejectReasonToKind(rejectReason);
      const pushed = pushBeat(beatOutboxRef.current, {
        ppiMs,
        errorEstimate:
          sample.errorEstimate != null && Number.isFinite(sample.errorEstimate)
            ? sample.errorEstimate
            : null,
        kind,
        blocker: typeof sample.blocker === "boolean" ? sample.blocker : null,
      });
      beatOutboxRef.current = pushed.outbox;
      // Passive tap for the developer H10 comparison; no-op unless the reference is recording.
      referenceRecorder.recordPrimaryBeat({
        tMs: frameNowMs,
        seq: pushed.seq,
        ppiMs,
        kind,
      });

      // Every SDK sample enters the LF/HF window (accepted or rejected with reason).
      ppiSampleWindowRef.current = appendPpiSample(ppiSampleWindowRef.current, {
        ppiMs,
        errorEstimate: sample.errorEstimate,
        blocker: sample.blocker,
        frameNowMs,
        mode,
        seq: pushed.seq,
      });
      appendedAny = true;

      if (!isUsablePpiMs(ppiMs)) {
        console.log(
          `Monitor: ⚠️ Filtrato PPI fuori range: ${ppiMs}ms` +
            (sample.hr > 0 ? ` hr=${sample.hr}` : "")
        );
        if (sample.hr > 0) {
          applyLiveHeartRate(sample.hr);
        } else if (heartRateRef.current <= 0) {
          noteMissingSignal();
        }
        return;
      }

      notePositiveSignal();
      lastValidPpiAtRef.current = lastPpiEventAtRef.current;
      if (sample.hr > 0) {
        applyLiveHeartRate(sample.hr);
      }

      const resolved = resolveRrInterval({
        ppiMs,
        hrBpm: sample.hr > 0 ? sample.hr : heartRateRef.current,
      });
      if (resolved) {
        rrMsRef.current = resolved.rrMs;
        rrSourceRef.current = resolved.rrSource;
      }
      sessionTrackBuffer.pushPpi({
        ppiMs,
        hr: sample.hr > 0 ? sample.hr : undefined,
        errorEstimate: sample.errorEstimate,
        blockerBit: sample.blocker,
      });

      ingestHrvInterval(
        "ppi",
        ppiMs,
        {
          errorEstimate: sample.errorEstimate,
          blocker: sample.blocker,
        },
        "PPI"
      );
    });

    if (appendedAny) {
      recomputeLfHfFromPpiWindow();
    }
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
    const launchGen = launchGenRef.current;
    const isStaleLaunch = () => launchGenRef.current !== launchGen;
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
        if (isStaleLaunch()) {
          return;
        }
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
          const streaming = await startPolarStreamingForProduct(
            polarProduct,
            deviceId,
            polarSdk
          );
          if (isStaleLaunch()) {
            return;
          }
          if (streaming.ppi || streaming.hr || streaming.ecg) {
            localStreamingDeviceRef.current = deviceId;
          }
        }
      };

      // Local metrics (PPI / skin temp) must not wait for Become auth — HR already
      // arrives via BLE notifications; streams need an explicit SDK start.
      console.log("💓 Avvio streaming device (locale, indipendente da auth)...");
      await startDeviceStreaming();
      if (isStaleLaunch()) {
        return;
      }
      // UI flush at 1 Hz; Ably publish inside flush stays auth-gated.
      startBiometricSending();
      // Estesa: avvia subito il timer di acquisizione (non aspetta il primo PPI buono).
      if (useSettingsStore.getState().hrvAnalysisMode === "clinical") {
        hrvEpochRef.current = markHrvAcquisitionStarted(
          hrvEpochRef.current,
          Date.now()
        );
        syncHrvEpochProgressUi();
      }

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
            storedAuthData.deviceCode,
            connectedDeviceNameRef.current || storedAuthData.deviceName
          );

          // Streaming locale già avviato post-FTU; qui solo Ably / track.
          await startDeviceStreaming();
          if (isStaleLaunch()) {
            return;
          }

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
                pollResponse.deviceCode,
                connectedDeviceNameRef.current
              );

              await startDeviceStreaming();
              if (isStaleLaunch()) {
                return;
              }

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
      if (launchGenRef.current === launchGen) {
        authStreamInFlightRef.current = false;
      }
    }
  };

  const resetHrPublishBucket = () => {
    hrSumBucketRef.current = 0;
    hrCountBucketRef.current = 0;
  };

  /** Flush Monitor UI + one Ably heartRate at 1 Hz. */
  const flushPolarLiveMetrics = () => {
    const now = Date.now();
    const rateHz = 1 as const;
    const intervalMs = polarLiveIntervalMs(rateHz);
    if (
      lastPolarLiveFlushAtRef.current > 0 &&
      now - lastPolarLiveFlushAtRef.current < intervalMs
    ) {
      return;
    }
    lastPolarLiveFlushAtRef.current = now;

    const avgHr = averageHrFromBucket(
      hrSumBucketRef.current,
      hrCountBucketRef.current
    );
    resetHrPublishBucket();

    if (avgHr != null) {
      setHeartRate(avgHr);
      heartRateRef.current = avgHr;
    }

    // Estesa: tick UI del timer di acquisizione a 1 Hz (anche senza PPI accettati).
    if (
      useSettingsStore.getState().hrvAnalysisMode === "clinical" &&
      hrvEpochRef.current.wallClockStartedAt != null
    ) {
      if (
        isHrvAcquisitionTimedOut(
          hrvEpochRef.current,
          CLINICAL_ACQUISITION_TIMEOUT_MS,
          now
        )
      ) {
        handleClinicalAcquisitionTimeout();
      } else {
        syncHrvEpochProgressUi(now);
      }
    }

    const hr = heartRateRef.current;
    const currentHrv = hrvRef.current;
    const lf = lfPowerRef.current;
    const hf = hfPowerRef.current;
    const currentLfHfStatus = lfHfStatusRef.current;
    // LF/HF only with HRV ready (same gate as starting Ably heartRate).
    const lfHfShown =
      currentHrv > 0 && isLfHfPublishable(currentLfHfStatus);
    const currentRrMs = rrMsRef.current;
    const currentRrSource = rrSourceRef.current;

    if (currentHrv > 0) {
      setHrv(currentHrv);
    }
    if (lfHfShown && lf > 0) {
      setLfPower(lf);
    }
    if (lfHfShown && hf > 0) {
      setHfPower(hf);
    }
    if (currentRrMs > 0) {
      setRrMs(currentRrMs);
      setRrSource(currentRrSource);
    }

    const userStateBiometric = useUserStore.getState();
    const deviceLabel =
      connectedDeviceNameRef.current || connectedDeviceIdRef.current || "Polar";

    if (
      connectedDeviceIdRef.current &&
      hr > 0 &&
      lastPositiveSignalAtRef.current > 0 &&
      now - lastPositiveSignalAtRef.current >= SIGNAL_LOSS_MS
    ) {
      clearLiveBiometricMetrics();
      // When Ably is latched, continue to publish a stale heartRate tick below.
      if (!ablyHeartRateLatchedRef.current) {
        return;
      }
    }

    if (debugMode) {
      console.log("🔍 DEBUG BIOMETRIC FLUSH - rateHz:", rateHz, "hr:", hr);
    }

    const isMuseFamily = connectedFamilyRef.current === "muse";
    // Polar: wait until HRV window/epoch is ready (Live: 30 beats). Muse has no HRV gate.
    const hrvReadyForAbly = isMuseFamily || currentHrv > 0;
    const hasAuth = !!(
      userStateBiometric.authToken &&
      userStateBiometric.userId &&
      userStateBiometric.deviceCode
    );
    const shouldPublish = shouldPublishLiveHeartRate({
      latched: ablyHeartRateLatchedRef.current,
      hasAuth,
      hr,
      hrvReady: hrvReadyForAbly,
    });

    if (ablyService.current && shouldPublish && userStateBiometric.userId) {
      const isMuse = isMuseFamily;
      const publishHr = heartRateRef.current;
      const signalStale =
        ablyHeartRateLatchedRef.current && publishHr <= 0;
      if (signalStale) {
        if (signalStaleSinceRef.current <= 0) {
          signalStaleSinceRef.current = now;
        }
      } else {
        signalStaleSinceRef.current = 0;
      }
      const staleSinceMs =
        signalStale && signalStaleSinceRef.current > 0
          ? now - signalStaleSinceRef.current
          : null;

      // Re-read metrics after a possible clear above.
      const liveHrv = hrvRef.current;
      const liveLf = lfPowerRef.current;
      const liveHf = hfPowerRef.current;
      const liveLfHfStatus = lfHfStatusRef.current;
      const liveLfHfShown =
        !signalStale && liveHrv > 0 && isLfHfPublishable(liveLfHfStatus);
      const liveRrSource = rrSourceRef.current;
      const sid = ensureAblySessionId();
      const deviceCode = userStateBiometric.deviceCode;

      if (!isMuse) {
        publishSessionMetaIfNeeded(userStateBiometric.userId, deviceCode);
      }

      let payload: Record<string, unknown>;
      let ackUpToSeq: number | null = null;
      let firstBeatSeq: number | null = null;

      if (isMuse) {
        payload = {
          deviceId: connectedDeviceIdRef.current,
          deviceFamily: "muse",
          hr: signalStale ? 0 : publishHr,
          alpha: signalStale ? null : bandAlphaRef.current || null,
          theta: signalStale ? null : bandThetaRef.current || null,
          beta: signalStale ? null : bandBetaRef.current || null,
          delta: signalStale ? null : bandDeltaRef.current || null,
          gamma: signalStale ? null : bandGammaRef.current || null,
          signalStale,
          staleSinceMs,
        };
      } else if (liveRrSource === "ecg_rr") {
        payload = buildPolarH10HeartRateTick({
          sid,
          hr: signalStale ? 0 : publishHr,
          signalStale,
          hrv: !signalStale && liveHrv > 0 ? liveHrv : null,
          lfPower: liveLfHfShown ? liveLf : null,
          hfPower: liveLfHfShown ? liveHf : null,
          lfHfStatus: signalStale ? "unavailable" : liveLfHfStatus,
          rrsMs: polarHrExtrasRef.current.rrsMs,
        }) as unknown as Record<string, unknown>;
      } else {
        // Stale tick sends no beats: keep them queued (no ack, no in-flight).
        const pending = signalStale
          ? []
          : selectPending(beatOutboxRef.current);
        if (pending.length > 0) {
          firstBeatSeq = pending[0][0];
          ackUpToSeq = pending[pending.length - 1][0];
          beatOutboxRef.current = markInFlight(
            beatOutboxRef.current,
            ackUpToSeq
          );
        }
        windowCrcTickCounterRef.current += 1;
        const includeCrc =
          windowCrcTickCounterRef.current % WINDOW_CRC_EVERY_N_TICKS === 0;
        const checkpoint = buildWindowCheckpoint(ppiSampleWindowRef.current);
        payload = buildPolarHeartRateTick({
          sid,
          hr: signalStale ? 0 : publishHr,
          signalStale,
          hrv: !signalStale && liveHrv > 0 ? liveHrv : null,
          lfPower: liveLfHfShown ? liveLf : null,
          hfPower: liveLfHfShown ? liveHf : null,
          lfHfStatus: signalStale ? "unavailable" : liveLfHfStatus,
          beats: pending,
          windowFromSeq: signalStale ? null : checkpoint.windowFromSeq,
          includeWindowCheckpoint: !signalStale && includeCrc,
          windowCrc: checkpoint.windowCrc,
          windowBeatCount: checkpoint.windowBeatCount,
          blocker: polarPpiExtrasRef.current.blocker,
          contactStatus:
            polarPpiExtrasRef.current.skinContactSupported === true
              ? polarPpiExtrasRef.current.skinContactStatus
              : polarHrExtrasRef.current.contactSupported === true
                ? polarHrExtrasRef.current.contactDetected
                : null,
          skinTemperatureC: signalStale
            ? null
            : skinTemperatureCRef.current,
        }) as unknown as Record<string, unknown>;
      }

      const publishPromise = ablyService.current.sendMessage(
        userStateBiometric.userId,
        "heartRate",
        payload,
        deviceCode
      );
      if (ackUpToSeq != null && firstBeatSeq != null) {
        const seqToAck = ackUpToSeq;
        const seqFrom = firstBeatSeq;
        publishPromise.then((ok) => {
          // Late result from a previous session: seqs restarted, ignore.
          if (ablySessionIdRef.current !== sid) return;
          beatOutboxRef.current = ok
            ? ackUpTo(beatOutboxRef.current, seqToAck)
            : nackFrom(beatOutboxRef.current, seqFrom);

        });
      }
      ablyTickCountRef.current += 1;
      if (!ablyHeartRateLatchedRef.current) {
        ablyHeartRateLatchedRef.current = true;
        setAblyHeartRateLatched(true);
      }
      bumpAblyPulse();
    }

    if (connectedDeviceIdRef.current) {
      const fgHr = heartRateRef.current;
      const fgHrv = hrvRef.current;
      const fgLf = lfPowerRef.current;
      const fgHf = hfPowerRef.current;
      polarSdk
        .updateMonitorForegroundService(
          deviceLabel,
          fgHr,
          fgHrv > 0 ? fgHrv : 0,
          fgLf > 0 ? fgLf : 0,
          fgHf > 0 ? fgHf : 0
        )
        .catch(() => {});
    }
  };

  const clearAblyHeartRateLatch = () => {
    const user = useUserStore.getState();
    if (user.userId && ablyHeartRateLatchedRef.current) {
      publishSessionEnd(user.userId, user.deviceCode);
    }
    ablyHeartRateLatchedRef.current = false;
    signalStaleSinceRef.current = 0;
    setAblyHeartRateLatched(false);
    ablyService.current?.resetSendStats();
    beatOutboxRef.current = createBeatOutbox();
    ablySessionIdRef.current = null;
    ablyTickCountRef.current = 0;
    sessionMetaSentForEpRef.current = null;
    windowCrcTickCounterRef.current = 0;
  };

  const startBiometricSending = () => {
    if (biometricInterval.current) {
      clearInterval(biometricInterval.current);
    }
    lastPolarLiveFlushAtRef.current = 0;
    biometricInterval.current = setInterval(() => {
      flushPolarLiveMetrics();
    }, POLAR_LIVE_TICK_MS);
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

  const cancelHrZeroClear = () => {
    if (hrZeroTimeoutRef.current) {
      clearTimeout(hrZeroTimeoutRef.current);
      hrZeroTimeoutRef.current = null;
    }
    hrZeroSinceRef.current = 0;
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
    lfHfStatusRef.current = "unavailable";
    setLfHfStatus("unavailable");
    setLfHfProgress(null);
    lfHfRatioRef.current = null;
    setLfHfRatio(null);
    setRrMs(0);
    rrMsRef.current = 0;
    setRrSource(null);
    rrSourceRef.current = null;
    setEcgMicroVolts(0);
    setSkinTemperatureC(0);
    skinTemperatureCRef.current = 0;
    polarPpiExtrasRef.current = { ...EMPTY_POLAR_PPI_EXTRAS };
    polarHrExtrasRef.current = { ...EMPTY_POLAR_HR_EXTRAS };
    setPolarSignalQuality({ ...EMPTY_POLAR_SIGNAL_QUALITY });
    setMuseHr(0);
    // Clears HRV epoch + PPI window (bumps Ably beat epoch once).
    resetHrvEpochAccumulator(false);
    lastValidPpiAtRef.current = 0;
    lastPpiEventAtRef.current = 0;
    hrSumBucketRef.current = 0;
    hrCountBucketRef.current = 0;
    lastPolarLiveFlushAtRef.current = 0;
    cancelHrZeroClear();
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

  const applyLiveHeartRate = (hr: number) => {
    if (hr <= 0) {
      return;
    }
    cancelHrZeroClear();
    notePositiveSignal();
    heartRateRef.current = hr;
    hrSumBucketRef.current += hr;
    hrCountBucketRef.current += 1;
  };

  const resetDeviceState = () => {
    cancelSignalLossClear();
    lastPositiveSignalAtRef.current = 0;
    localStreamingDeviceRef.current = null;
    resetScanState();
    resetUserState();
    setHeartRate(0);
    heartRateRef.current = 0;
    setHrv(0);
    hrvRef.current = 0;
    setLfPower(0);
    lfPowerRef.current = 0;
    setHfPower(0);
    hfPowerRef.current = 0;
    lfHfStatusRef.current = "unavailable";
    setLfHfStatus("unavailable");
    setLfHfProgress(null);
    lfHfRatioRef.current = null;
    setLfHfRatio(null);
    setRrMs(0);
    rrMsRef.current = 0;
    hrSumBucketRef.current = 0;
    hrCountBucketRef.current = 0;
    lastPolarLiveFlushAtRef.current = 0;
    setRrSource(null);
    setEcgMicroVolts(0);
    setSkinTemperatureC(0);
    skinTemperatureCRef.current = 0;
    polarPpiExtrasRef.current = { ...EMPTY_POLAR_PPI_EXTRAS };
    polarHrExtrasRef.current = { ...EMPTY_POLAR_HR_EXTRAS };
    setPolarSignalQuality({ ...EMPTY_POLAR_SIGNAL_QUALITY });
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
    resetHrvEpochAccumulator(false);
    lastValidPpiAtRef.current = 0;
    lastPpiEventAtRef.current = 0;
    cancelHrZeroClear();
    clearAblyHeartRateLatch();
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

  /**
   * Dev / re-pair: drop Become session, keep BLE up, request a fresh 4-digit code
   * via `launchAuthAndStream` (startDeviceAuth + poll).
   */
  const restartBecomePairingCode = async (deviceId: string) => {
    console.log(`Monitor: 🔄 Restart pairing code for ${deviceId}`);
    await authService.current.clearAuthData(deviceId);
    // Also wipe any leftover sessions (Settings "clear all" path / legacy keys).
    await authService.current.clearAuthData();
    setAuthToken("");
    setUserId(0);
    setDeviceCode("");
    setAuthCode("");
    setAppId("");
    clearAblyHeartRateLatch();
    ablyService.current?.close();
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
    launchGenRef.current += 1;
    authStreamInFlightRef.current = false;
    streamReadyDeviceRef.current = null;
    authSessionDeviceRef.current = null;

    const family = connectedFamilyRef.current === "muse" ? "muse" : "polar";
    await launchAuthAndStream(
      deviceId,
      connectedDeviceNameRef.current || undefined,
      family
    );

    // launchAuthAndStream sets authCode on success; surface a hard failure if not.
    const codeAfter = useUserStore.getState().authCode;
    const tokenAfter = useUserStore.getState().authToken;
    if (!tokenAfter && !codeAfter) {
      console.error("Monitor: ❌ Pairing restart produced no authCode");
      Alert.alert(
        "Codice non disponibile",
        "Impossibile ottenere un nuovo codice a 4 cifre dal server. Controlla la rete / Developer Mode (staging) e riprova."
      );
    }
  };

  // Settings → Invalida token: if BLE is still up, fetch a fresh 4-digit code.
  useEffect(() => {
    if (authInvalidateNonce <= 0) {
      return;
    }
    const deviceId = connectedDeviceIdRef.current;
    if (!deviceId) {
      return;
    }
    console.log(
      `Monitor: 🔔 authInvalidateNonce=${authInvalidateNonce} → restart pairing`
    );
    void restartBecomePairingCode(deviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authInvalidateNonce]);

  const resetAuthSessionForDevice = () => {
    if (!developerMode) {
      return;
    }
    if (!connectedDeviceId) {
      setDeviceMenuOpen(false);
      Alert.alert(
        "Invalida token Become",
        "Cancellare tutti i token Become salvati su questo telefono? Al prossimo collegamento dovrai inserire di nuovo il codice a 4 cifre.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Invalida",
            style: "destructive",
            onPress: () => {
              void clearStoredAuth();
            },
          },
        ]
      );
      return;
    }
    const deviceId = connectedDeviceId;
    const deviceLabel =
      connectedProduct?.displayName || connectedDeviceName || deviceId;
    setDeviceMenuOpen(false);
    Alert.alert(
      "Invalida token Become",
      `Cancellare il token per ${deviceLabel} e mostrare un nuovo codice a 4 cifre? Il Bluetooth resta collegato.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Invalida",
          style: "destructive",
          onPress: async () => {
            try {
              await restartBecomePairingCode(deviceId);
              setNotification({
                type: "success",
                message: "Token invalidato — inserisci il nuovo codice sul PC",
              });
            } catch (error: any) {
              console.error("Monitor: Errore reset auth token:", error?.message);
              Alert.alert(
                "Errore",
                error?.message || "Impossibile resettare il token"
              );
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
      if (ablyHeartRateLatched && (isSignalLost || heartRate <= 0)) {
        return "Connesso · segnale perso";
      }
      if (ablyHeartRateLatched || heartRate > 0) {
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
    ablyHeartRateLatched &&
    !!connectedDeviceId &&
    ablyStatus === ConnectionStatus.CONNECTED;

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

    ablyService.current.setSendStatsListener(setAblySendStats);
    ablyService.current.setEndSessionHandler((payload) => {
      console.log("Monitor: 📥 Ably endSession", payload);
      clearAblyHeartRateLatch();
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

      // Developer Mode: an H10 (hidden as primary device) can be picked as read-only reference.
      if (
        useSettingsStore.getState().developerMode &&
        !isSupportedPolarDevice(device.name) &&
        isPolarReferenceCandidate(device.name)
      ) {
        useReferenceStore.getState().upsertCandidate({
          deviceId: device.deviceId,
          name: device.name,
        });
        return;
      }

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
      launchGenRef.current += 1;
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

      // Screen off / app in background: the 1 Hz setInterval is throttled (30 ticks in
      // ~70 s) while native BLE events keep arriving. Also flush from the HR event
      // (after this handler's synchronous body); the 1 Hz guard in flush keeps one
      // publish per second whichever trigger fires first.
      Promise.resolve().then(flushPolarLiveMetrics);

      polarHrExtrasRef.current = stashPolarHrExtras(data);
      syncPolarSignalQualityUi();

      const noContact =
        data.contactSupported === true && data.contactDetected === false;
      if (noContact) {
        noteMissingSignal();
      } else if (data.hr > 0) {
        applyLiveHeartRate(data.hr);
      } else {
        // Packets still arrive with hr=0 (Polar optical dropout). Do not wipe at 2.5s.
        cancelSignalLossClear();
        lastPositiveSignalAtRef.current = Date.now();
        if (hrZeroSinceRef.current <= 0) {
          hrZeroSinceRef.current = Date.now();
        }
        if (!hrZeroTimeoutRef.current) {
          hrZeroTimeoutRef.current = setTimeout(() => {
            hrZeroTimeoutRef.current = null;
            if (
              heartRateRef.current > 0 &&
              isSustainedHrZero(hrZeroSinceRef.current, Date.now())
            ) {
              console.log(
                `Monitor: 📭 HR=0 sostenuto per ${HR_ZERO_GRACE_MS}ms — reset metriche`
              );
              clearLiveBiometricMetrics();
            }
          }, HR_ZERO_GRACE_MS);
        }
      }
      const hrForStream = data.hr > 0 ? data.hr : heartRateRef.current;

      const product = resolvePolarProduct(connectedDeviceNameRef.current);
      const nativeRrs = data.rrsMs?.filter((rr) => isUsablePpiMs(rr));
      const now = Date.now();
      const ppiRrIsFresh = isFresh(
        lastValidPpiAtRef.current,
        now,
        PPI_STALE_MS
      );

      if (nativeRrs && nativeRrs.length > 0 && product?.capabilities.rawEcg) {
        nativeRrs.forEach((rr) => {
          const resolved = resolveRrInterval({
            ecgRrMs: rr,
            hrBpm: hrForStream > 0 ? hrForStream : undefined,
          });
          if (resolved) {
            rrMsRef.current = resolved.rrMs;
            rrSourceRef.current = resolved.rrSource;
          }
          sessionTrackBuffer.pushEcgRr({
            rrMs: rr,
            hr: hrForStream > 0 ? hrForStream : undefined,
          });
          ingestHrvInterval("ecg_rr", rr, {}, "RR ECG");
        });
        return;
      }

      if (data.hr > 0) {
        if (product?.capabilities.rawEcg || rrSourceRef.current === "ecg_rr") {
          return;
        }
        if (rrSourceRef.current === "ppi" && ppiRrIsFresh) {
          return;
        }

        const ppiStreamAlive = isFresh(
          lastPpiEventAtRef.current,
          Date.now(),
          PPI_STREAM_ALIVE_MS
        );
        const approximateRR = Math.round(60000 / data.hr);
        const resolved = resolveRrInterval({ hrBpm: data.hr });
        if (resolved) {
          rrMsRef.current = resolved.rrMs;
          rrSourceRef.current = resolved.rrSource;
          if (lastValidPpiAtRef.current <= 0) {
            sessionTrackBuffer.pushHr(data.hr);
          }
        }

        // Clinical never uses HR-derived RR. Client only if PPI stream is dead.
        const mode = useSettingsStore.getState().hrvAnalysisMode;
        if (mode === "clinical" || ppiStreamAlive) {
          return;
        }

        ingestHrvInterval("hr_derived", approximateRR, {}, "da HR");
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
          launchGenRef.current += 1;
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
            setMuseHr(data.hr);
            applyLiveHeartRate(data.hr);
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
    ablySendStats,
    isStreamingLive,

    // Metrics - Polar
    heartRate,
    hrv,
    lfPower,
    hfPower,
    lfHfStatus,
    lfHfProgress,
    lfHfRatio,
    rrMs,
    rrSource,
    ecgMicroVolts,
    skinTemperatureC,
    isSignalLost,
    polarSignalQuality,
    hrvAnalysisMode,
    hrvEpochInvalid,
    hrvProgressLabel: formatHrvProgressLabel(
      hrvAnalysisMode,
      hrvEpochProgress.intervalCount,
      hrvEpochProgress.acceptedDurationMs
    ),
    hrvWallElapsedLabel: formatDurationMmSs(hrvEpochProgress.wallElapsedMs),
    ppiWindowLength: hrvEpochProgress.intervalCount,
    hrvAcceptedDurationMs: hrvEpochProgress.acceptedDurationMs,
    hrvWallElapsedMs: hrvEpochProgress.wallElapsedMs,

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

    // Debug / developer
    debugMode,
    developerMode,
  };
}
