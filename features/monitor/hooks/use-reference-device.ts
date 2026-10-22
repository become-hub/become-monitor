/**
 * Reference device (developer validation): Polar H10 next to a 360/Loop on the same phone.
 *
 * Owns only the H10 side: scan candidates (fed by use-monitor-session's onDeviceFound),
 * connect, stream RR, export CSV. It never touches the primary session, Ably or live LF/HF;
 * the 360 beats reach [referenceRecorder] through a single passive call in handlePpiData.
 */

import { useCallback, useEffect, useState } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";

import { polarSdk } from "@/features/devices/polar/polar-ble-sdk";
import {
  referenceRecorder,
  type ReferenceRecorderSummary,
} from "@/features/hrv/reference/reference-recorder";
import { useReferenceStore } from "@/stores/reference-store";

const SUMMARY_POLL_MS = 1000;

function referenceCsvFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `polar360-vs-h10_${stamp}.csv`;
}

function readSummary(): ReferenceRecorderSummary {
  return referenceRecorder.getSummary();
}

export function useReferenceDevice(enabled: boolean) {
  const status = useReferenceStore((s) => s.status);
  const candidates = useReferenceStore((s) => s.candidates);
  const deviceName = useReferenceStore((s) => s.deviceName);
  const errorMessage = useReferenceStore((s) => s.errorMessage);
  const [summary, setSummary] = useState<ReferenceRecorderSummary>(readSummary);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const store = useReferenceStore.getState;

    polarSdk.addEventListener("onReferenceDeviceConnected", (device) => {
      store().setDevice(device.deviceId, device.name ?? store().deviceName);
      polarSdk
        .startReferenceHrStreaming(device.deviceId)
        .then(() => {
          referenceRecorder.clear();
          referenceRecorder.setActive(true);
          store().setStatus("streaming");
        })
        .catch((e: unknown) => {
          store().setStatus(
            "error",
            e instanceof Error ? e.message : "Streaming H10 non avviato"
          );
        });
    });

    polarSdk.addEventListener("onReferenceDeviceDisconnected", () => {
      referenceRecorder.setActive(false);
      store().setDevice(null, null);
      store().setStatus("idle");
    });

    polarSdk.addEventListener("onReferenceHrReceived", (data) => {
      const tMs = data.nativeAtMs ?? Date.now();
      referenceRecorder.recordReferencePacket({
        tMs,
        hr: data.hr,
        rrsMs: data.rrsMs,
      });
    });

    polarSdk.addEventListener("onReferenceHrStreamError", (e) => {
      referenceRecorder.setActive(false);
      store().setStatus("error", e.error);
    });

    return () => {
      referenceRecorder.setActive(false);
      polarSdk.stopReferenceHrStreaming().catch(() => {});
      polarSdk.disconnectReferenceDevice().catch(() => {});
      polarSdk.removeEventListener("onReferenceDeviceConnected");
      polarSdk.removeEventListener("onReferenceDeviceDisconnected");
      polarSdk.removeEventListener("onReferenceHrReceived");
      polarSdk.removeEventListener("onReferenceHrStreamError");
      store().reset();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const id = setInterval(() => setSummary(readSummary()), SUMMARY_POLL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  const startScan = useCallback(async () => {
    const store = useReferenceStore.getState();
    store.clearCandidates();
    store.setStatus("scanning");
    try {
      await polarSdk.startScan();
    } catch (e) {
      store.setStatus(
        "error",
        e instanceof Error ? e.message : "Scansione non avviata"
      );
    }
  }, []);

  const connect = useCallback(async (deviceId: string, name: string) => {
    const store = useReferenceStore.getState();
    await polarSdk.stopScan().catch(() => {});
    store.setDevice(deviceId, name);
    store.setStatus("connecting");
    try {
      await polarSdk.connectReferenceDevice(deviceId);
    } catch (e) {
      store.setDevice(null, null);
      store.setStatus(
        "error",
        e instanceof Error ? e.message : "Connessione H10 fallita"
      );
    }
  }, []);

  const disconnect = useCallback(async () => {
    referenceRecorder.setActive(false);
    await polarSdk.stopReferenceHrStreaming().catch(() => {});
    await polarSdk.disconnectReferenceDevice().catch(() => {});
    const store = useReferenceStore.getState();
    store.setDevice(null, null);
    store.setStatus("idle");
    setSummary(readSummary());
  }, []);

  /** Scrive un .csv nella cache e apre lo share sheet (salva su file / Drive / Telegram come documento). */
  const exportCsv = useCallback(async () => {
    const csv = referenceRecorder.toCsv();
    if (!(await Sharing.isAvailableAsync())) {
      await Share.share({ title: "Registrazione 360 + H10", message: csv });
      return;
    }
    const file = new File(Paths.cache, referenceCsvFileName(new Date()));
    file.create({ overwrite: true });
    file.write(csv);
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
      dialogTitle: "Registrazione 360 + H10",
    });
  }, []);

  const clearRecording = useCallback(() => {
    referenceRecorder.clear();
    setSummary(readSummary());
  }, []);

  return {
    status,
    candidates,
    deviceName,
    errorMessage,
    summary,
    startScan,
    connect,
    disconnect,
    exportCsv,
    clearRecording,
  };
}
