/**
 * Declarative session corrections. Never mutates raw beats — returns a derived
 * labelled result (recomputeVersion + policy hash).
 */

import type { HrvAnalysisMode } from "@/features/hrv/core/hrv-analysis-mode";
import type { IngestedSession, SessionBeat } from "./ingest";
import { replaySession, type ReplayOutput, type ReplayPolicy } from "./replay";

export type Correction =
  | { type: "exclude_blocker" }
  | { type: "error_estimate_max_ms"; maxMs: number }
  | { type: "mask_seq_range"; fromSeq: number; toSeq: number }
  | { type: "force_mode"; mode: HrvAnalysisMode };

export type CorrectedResult = {
  sid: string;
  algoVersion: string;
  recomputeVersion: string;
  policy: Correction[];
  inputHash: string;
  replay: ReplayOutput;
  /** Beats after correction (derived; raw session unchanged). */
  beats: SessionBeat[];
};

function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function applyCorrectionsToBeats(
  beats: SessionBeat[],
  corrections: Correction[]
): SessionBeat[] {
  let out = beats.map((b) => ({ ...b }));
  for (const c of corrections) {
    if (c.type === "exclude_blocker") {
      out = out.map((b) =>
        b.blocker === 1
          ? {
              ...b,
              kind: 1 as const,
            }
          : b
      );
    } else if (c.type === "mask_seq_range") {
      out = out.map((b) =>
        b.seq >= c.fromSeq && b.seq <= c.toSeq
          ? { ...b, kind: 1 as const }
          : b
      );
    } else if (c.type === "error_estimate_max_ms") {
      out = out.map((b) =>
        b.errorEstimate != null && b.errorEstimate > c.maxMs
          ? { ...b, kind: 1 as const }
          : b
      );
    }
  }
  return out;
}

function policyFromCorrections(corrections: Correction[]): ReplayPolicy {
  const forceMode = corrections.find((c) => c.type === "force_mode");
  const errMax = corrections.find((c) => c.type === "error_estimate_max_ms");
  if (forceMode || errMax) {
    return {
      type: "reclassify",
      mode: forceMode && forceMode.type === "force_mode" ? forceMode.mode : undefined,
      errorEstimateMaxMs:
        errMax && errMax.type === "error_estimate_max_ms"
          ? errMax.maxMs
          : undefined,
    };
  }
  return { type: "faithful" };
}

/**
 * Apply corrections and replay. Raw `session` is never mutated.
 */
export function correctSession(
  session: IngestedSession,
  corrections: Correction[],
  options?: { algoVersion?: string; recomputeVersion?: string }
): CorrectedResult {
  const derivedBeats = applyCorrectionsToBeats(session.beats, corrections);
  const derivedSession: IngestedSession = {
    ...session,
    beats: derivedBeats,
  };
  const policy = policyFromCorrections(corrections);
  const replay = replaySession(derivedSession, {
    algoVersion: options?.algoVersion ?? "hrv-1",
    policy,
  });
  const inputHash = simpleHash(
    JSON.stringify({
      sid: session.sid,
      seqs: session.beats.map((b) => b.seq),
      corrections,
    })
  );
  return {
    sid: session.sid,
    algoVersion: replay.algoVersion,
    recomputeVersion: options?.recomputeVersion ?? `corr-${inputHash.slice(0, 6)}`,
    policy: corrections,
    inputHash,
    replay,
    beats: derivedBeats,
  };
}
