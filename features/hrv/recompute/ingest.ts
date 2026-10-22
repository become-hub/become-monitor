/**
 * Normalize raw Ably session events into ordered, deduplicated beats.
 */

import type { PolarBeatTuple } from "@/features/hrv/ppi/beat-outbox";
import type {
  PolarHeartRateTickV2,
  PolarSessionEndV2,
  PolarSessionMetaV2,
} from "@/features/hrv/contract/types";

export type RawAblyEvent = {
  type?: string;
  timestamp?: string;
  [key: string]: unknown;
};

export type SessionBeat = {
  seq: number;
  ppiMs: number;
  errorEstimate: number | null;
  kind: 0 | 1 | 2;
  blocker: 0 | 1;
  ep: number;
  frameId: number;
};

export type IngestedSession = {
  sid: string;
  beats: SessionBeat[];
  ticks: PolarHeartRateTickV2[];
  metas: PolarSessionMetaV2[];
  sessionEnd: PolarSessionEndV2 | null;
};

function isBeatTuple(value: unknown): value is PolarBeatTuple {
  return (
    Array.isArray(value) &&
    value.length === 7 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function beatFromTuple(t: PolarBeatTuple): SessionBeat {
  return {
    seq: t[0],
    ppiMs: t[1],
    errorEstimate: t[2],
    kind: t[3] as 0 | 1 | 2,
    blocker: t[4] as 0 | 1,
    ep: t[5],
    frameId: t[6],
  };
}

/**
 * Ingest Ably events for one session. Deduplicates beats by seq (outbox may
 * retransmit). Groups remain ordered by seq.
 */
export function ingestSessionEvents(
  events: RawAblyEvent[],
  sid?: string
): IngestedSession {
  const sorted = [...events].sort((a, b) => {
    const ta = typeof a.timestamp === "string" ? a.timestamp : "";
    const tb = typeof b.timestamp === "string" ? b.timestamp : "";
    return ta.localeCompare(tb);
  });

  const beatsBySeq = new Map<number, SessionBeat>();
  const ticks: PolarHeartRateTickV2[] = [];
  const metas: PolarSessionMetaV2[] = [];
  let sessionEnd: PolarSessionEndV2 | null = null;
  let resolvedSid = sid ?? "";

  for (const ev of sorted) {
    if (typeof ev.sid === "string" && !resolvedSid) {
      resolvedSid = ev.sid;
    }
    if (ev.type === "sessionMeta") {
      metas.push(ev as unknown as PolarSessionMetaV2);
      continue;
    }
    if (ev.type === "sessionEnd") {
      sessionEnd = ev as unknown as PolarSessionEndV2;
      continue;
    }
    if (ev.type === "heartRate" && Array.isArray(ev.beats)) {
      const tick = ev as unknown as PolarHeartRateTickV2;
      ticks.push(tick);
      for (const raw of tick.beats) {
        if (!isBeatTuple(raw)) continue;
        const beat = beatFromTuple(raw);
        if (!beatsBySeq.has(beat.seq)) {
          beatsBySeq.set(beat.seq, beat);
        }
      }
    }
  }

  const beats = [...beatsBySeq.values()].sort((a, b) => a.seq - b.seq);
  return {
    sid: resolvedSid,
    beats,
    ticks,
    metas,
    sessionEnd,
  };
}

/** Group beats by epoch, then by frameId (sorted). */
export function groupBeatsByEpochAndFrame(
  beats: SessionBeat[]
): Map<number, Map<number, SessionBeat[]>> {
  const byEp = new Map<number, Map<number, SessionBeat[]>>();
  for (const beat of beats) {
    let byFrame = byEp.get(beat.ep);
    if (!byFrame) {
      byFrame = new Map();
      byEp.set(beat.ep, byFrame);
    }
    const list = byFrame.get(beat.frameId) ?? [];
    list.push(beat);
    byFrame.set(beat.frameId, list);
  }
  return byEp;
}
