/**
 * Integrity report for an ingested session (seq gaps, CRC, sessionEnd).
 */

import { windowCrc } from "@/features/hrv/ppi/window-checkpoint";
import {
  appendPpiSample,
  createEmptyPpiSampleWindow,
  type PpiSampleWindow,
} from "@/features/hrv/ppi/ppi-sample-window";
import { codeToRejectReason } from "@/features/hrv/ppi/beat-outbox";
import type { IngestedSession, SessionBeat } from "./ingest";

export type SeqGap = { from: number; to: number };

export type IntegrityReport = {
  sid: string;
  beatCount: number;
  gaps: SeqGap[];
  crcMismatches: { tickIndex: number; expected: string; actual: string }[];
  sessionEndOk: boolean | null;
  epochsWithoutMeta: number[];
  filledFromTrack: number;
};

export function findSeqGaps(beats: SessionBeat[]): SeqGap[] {
  if (beats.length === 0) return [];
  const gaps: SeqGap[] = [];
  for (let i = 1; i < beats.length; i += 1) {
    const prev = beats[i - 1].seq;
    const cur = beats[i].seq;
    if (cur > prev + 1) {
      gaps.push({ from: prev + 1, to: cur - 1 });
    }
  }
  return gaps;
}

function rebuildWindowFromBeats(
  beats: SessionBeat[],
  mode: "client" | "clinical" = "client"
): PpiSampleWindow {
  let w = createEmptyPpiSampleWindow();
  let t = 1_000_000;
  for (const b of beats) {
    w = appendPpiSample(w, {
      ppiMs: b.ppiMs,
      errorEstimate: b.errorEstimate,
      blocker: b.blocker === 1,
      frameNowMs: t,
      mode,
      seq: b.seq,
      rejectReasonOverride: codeToRejectReason(b.kind),
    });
    t += Math.max(0, b.ppiMs);
  }
  return w;
}

/**
 * Fill missing seqs from an offline ppiTrack when ppiMs sequences align.
 * Returns new beats list and count filled.
 */
export function fillGapsFromTrack(
  beats: SessionBeat[],
  trackPpiMs: number[],
  ep: number,
  frameId: number
): { beats: SessionBeat[]; filled: number } {
  const gaps = findSeqGaps(beats);
  if (gaps.length === 0 || trackPpiMs.length === 0) {
    return { beats, filled: 0 };
  }
  const bySeq = new Map(beats.map((b) => [b.seq, b]));
  let filled = 0;
  // Naive fill: for a single gap of length L, try to find a contiguous
  // trackPpiMs window matching neighbours; if not found, skip.
  for (const gap of gaps) {
    const before = bySeq.get(gap.from - 1);
    const after = bySeq.get(gap.to + 1);
    if (!before || !after) continue;
    const need = gap.to - gap.from + 1;
    for (let i = 0; i < trackPpiMs.length - need - 1; i += 1) {
      if (
        trackPpiMs[i] === before.ppiMs &&
        trackPpiMs[i + need + 1] === after.ppiMs
      ) {
        for (let k = 0; k < need; k += 1) {
          const seq = gap.from + k;
          if (bySeq.has(seq)) continue;
          bySeq.set(seq, {
            seq,
            ppiMs: trackPpiMs[i + 1 + k],
            errorEstimate: null,
            kind: 0,
            blocker: 0,
            ep,
            frameId,
          });
          filled += 1;
        }
        break;
      }
    }
  }
  return {
    beats: [...bySeq.values()].sort((a, b) => a.seq - b.seq),
    filled,
  };
}

export function assessIntegrity(
  session: IngestedSession,
  options?: { trackPpiMs?: number[] }
): IntegrityReport {
  let beats = session.beats;
  let filledFromTrack = 0;
  if (options?.trackPpiMs) {
    const filled = fillGapsFromTrack(
      beats,
      options.trackPpiMs,
      beats[0]?.ep ?? 1,
      0
    );
    beats = filled.beats;
    filledFromTrack = filled.filled;
  }

  const gaps = findSeqGaps(beats);
  const crcMismatches: IntegrityReport["crcMismatches"] = [];

  for (let i = 0; i < session.ticks.length; i += 1) {
    const tick = session.ticks[i];
    if (!tick.windowCrc || tick.windowFromSeq == null) continue;
    const from = tick.windowFromSeq;
    const count = tick.windowBeatCount ?? 0;
    const slice = beats.filter((b) => b.seq >= from).slice(0, count);
    if (slice.length !== count) continue;
    const w = rebuildWindowFromBeats(slice);
    const actual = windowCrc(w);
    if (actual !== tick.windowCrc) {
      crcMismatches.push({
        tickIndex: i,
        expected: tick.windowCrc,
        actual,
      });
    }
  }

  let sessionEndOk: boolean | null = null;
  if (session.sessionEnd) {
    sessionEndOk =
      session.sessionEnd.beatCount === beats.length &&
      session.sessionEnd.lastSeq ===
        (beats.length > 0 ? beats[beats.length - 1].seq : 0);
  }

  const metaEps = new Set(session.metas.map((m) => m.ep));
  const epochs = new Set(beats.map((b) => b.ep));
  const epochsWithoutMeta = [...epochs].filter((ep) => !metaEps.has(ep));

  return {
    sid: session.sid,
    beatCount: beats.length,
    gaps,
    crcMismatches,
    sessionEndOk,
    epochsWithoutMeta,
    filledFromTrack,
  };
}
