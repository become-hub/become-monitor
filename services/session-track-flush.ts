/**
 * Flush Polar offline PPI track (or live buffer fallback) and upload.
 */

import {
  PolarOfflinePpiTrack,
  polarSdk,
} from "./polar-ble-sdk";
import { sessionTrackBuffer } from "./session-track-buffer";
import {
  mapBufferSamplesToTrack,
  mapOfflineSamplesToTrack,
  TrackUploadPayload,
  uploadSessionTrack,
} from "./track-upload-service";

export interface FlushSessionTrackInput {
  deviceId: string;
  deviceCode?: string;
  userId?: number;
  authToken?: string;
  sessionId?: string | null;
}

export interface FlushSessionTrackResult {
  uploaded: boolean;
  dryRun: boolean;
  source: TrackUploadPayload["source"];
  sampleCount: number;
  path?: string;
}

export async function flushSessionTrack(
  input: FlushSessionTrackInput
): Promise<FlushSessionTrackResult> {
  const endedAt = new Date().toISOString();
  let offlineTrack: PolarOfflinePpiTrack | null = null;
  let source: TrackUploadPayload["source"] = "app_live_buffer";
  let samples = mapBufferSamplesToTrack(sessionTrackBuffer.getSamples());
  let startedAt = sessionTrackBuffer.getStartedAt();
  let path: string | undefined;

  try {
    await polarSdk.stopPpiOfflineRecording(input.deviceId);
  } catch (error: any) {
    console.warn(
      "flushSessionTrack: stop offline soft-fail:",
      error?.message || error
    );
  }

  try {
    offlineTrack = await polarSdk.fetchLatestPpiOfflineRecord(input.deviceId);
    if (offlineTrack.samples.length > 0) {
      source = "polar_offline_ppi";
      samples = mapOfflineSamplesToTrack(
        offlineTrack.samples,
        offlineTrack.startedAt
      );
      startedAt = offlineTrack.startedAt ?? startedAt;
      path = offlineTrack.path;
    }
  } catch (error: any) {
    console.warn(
      "flushSessionTrack: offline fetch failed, using live buffer:",
      error?.message || error
    );
  }

  const payload: TrackUploadPayload = {
    type: "ppiTrack",
    deviceId: input.deviceId,
    deviceCode: input.deviceCode,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    startedAt,
    endedAt,
    source,
    path,
    samples,
  };

  const upload = await uploadSessionTrack(payload, input.authToken);

  if (path && source === "polar_offline_ppi") {
    try {
      await polarSdk.removePpiOfflineRecord(input.deviceId, path);
    } catch (error: any) {
      console.warn(
        "flushSessionTrack: remove offline record failed:",
        error?.message || error
      );
    }
  }

  sessionTrackBuffer.clear();

  return {
    uploaded: upload.ok,
    dryRun: upload.dryRun,
    source,
    sampleCount: samples.length,
    path,
  };
}

export async function startSessionOfflineRecording(
  deviceId: string
): Promise<{ started: boolean; error?: string }> {
  sessionTrackBuffer.clear();
  try {
    await polarSdk.startPpiOfflineRecording(deviceId);
    return { started: true };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.warn(
      "startSessionOfflineRecording failed — live buffer fallback:",
      message
    );
    return { started: false, error: message };
  }
}
