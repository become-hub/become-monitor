/**
 * Upload session PPI/RR track to configurable service (spike).
 */

import { PolarOfflinePpiSample } from "./polar-ble-sdk";
import { resolveRrInterval } from "./rr-interval";
import { TrackSample } from "./session-track-buffer";

export type TrackSource = "polar_offline_ppi" | "app_live_buffer";

export interface TrackUploadSample {
  t?: string;
  ppiMs?: number;
  hr?: number;
  errorEstimate?: number;
  blockerBit?: boolean | number;
  rrMs: number;
  rrSource: "ppi" | "hr_derived";
}

export interface TrackUploadPayload {
  type: "ppiTrack";
  deviceId: string;
  deviceCode?: string;
  userId?: number;
  sessionId?: string | null;
  startedAt?: string | null;
  endedAt: string;
  source: TrackSource;
  path?: string;
  samples: TrackUploadSample[];
}

export function mapOfflineSamplesToTrack(
  samples: PolarOfflinePpiSample[],
  startedAt?: string | null
): TrackUploadSample[] {
  let cursorMs = startedAt ? Date.parse(startedAt) : Date.now();
  if (Number.isNaN(cursorMs)) {
    cursorMs = Date.now();
  }

  return samples.map((sample) => {
    const resolved = resolveRrInterval({
      ppiMs: sample.ppiMs,
      hrBpm: sample.hr,
    });
    const rrMs = resolved?.rrMs ?? sample.ppiMs;
    const rrSource = resolved?.rrSource ?? "ppi";
    const t = sample.t ?? new Date(cursorMs).toISOString();
    cursorMs += sample.ppiMs > 0 ? sample.ppiMs : 0;
    return {
      t,
      ppiMs: sample.ppiMs,
      hr: sample.hr,
      errorEstimate: sample.errorEstimate,
      blockerBit: sample.blockerBit,
      rrMs,
      rrSource,
    };
  });
}

export function mapBufferSamplesToTrack(
  samples: TrackSample[]
): TrackUploadSample[] {
  return samples.map((s) => ({
    t: s.t,
    ppiMs: s.ppiMs,
    hr: s.hr,
    errorEstimate: s.errorEstimate,
    blockerBit: s.blockerBit,
    rrMs: s.rrMs,
    rrSource: s.rrSource,
  }));
}

export function getTrackUploadUrl(): string {
  return (process.env.EXPO_PUBLIC_TRACK_UPLOAD_URL || "").trim();
}

export async function uploadSessionTrack(
  payload: TrackUploadPayload,
  authToken?: string
): Promise<{ ok: boolean; dryRun: boolean; status?: number }> {
  const url = getTrackUploadUrl();
  if (!url) {
    console.log(
      "TrackUpload: dry-run (EXPO_PUBLIC_TRACK_UPLOAD_URL empty)",
      JSON.stringify({
        type: payload.type,
        source: payload.source,
        samples: payload.samples.length,
        deviceId: payload.deviceId,
      })
    );
    return { ok: true, dryRun: true };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Track upload failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  return { ok: true, dryRun: false, status: response.status };
}
