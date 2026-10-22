/**
 * Deterministic session replay: rebuild LF/HF per epoch/frame like the live app.
 */

import {
  calculateRMSSD,
  type LfHfStatus,
} from "@/features/hrv/core/hrv-calculator";
import type { HrvAnalysisMode } from "@/features/hrv/core/hrv-analysis-mode";
import { codeToRejectReason } from "@/features/hrv/ppi/beat-outbox";
import { isUsablePpiMs } from "@/features/hrv/ppi/ppi-limits";
import {
  appendPpiSample,
  classifyPpiRejectReason,
  computeLfHfForPpiWindow,
  createEmptyPpiSampleWindow,
  type PpiRejectReason,
  type PpiSampleWindow,
} from "@/features/hrv/ppi/ppi-sample-window";
import { getAlgoParams } from "./algo-registry";
import {
  groupBeatsByEpochAndFrame,
  type IngestedSession,
  type SessionBeat,
} from "./ingest";

export type ReplayPolicy =
  | { type: "faithful" }
  | {
      type: "reclassify";
      mode?: HrvAnalysisMode;
      errorEstimateMaxMs?: number;
    };

export type FrameReplayResult = {
  ep: number;
  frameId: number;
  lastSeq: number;
  hrv: number | null;
  lf: number;
  hf: number;
  lfHfRatio: number | null;
  status: LfHfStatus;
  correctedPpiSeries: number[];
};

export type ReplayOutput = {
  sid: string;
  algoVersion: string;
  policy: ReplayPolicy;
  frames: FrameReplayResult[];
};

function appendBeatFaithful(
  window: PpiSampleWindow,
  beat: SessionBeat,
  mode: HrvAnalysisMode,
  t: number
): PpiSampleWindow {
  // Stored kind drives both the sample and the retention clock, exactly as
  // the live window did when the beat was classified.
  return appendPpiSample(window, {
    ppiMs: beat.ppiMs,
    errorEstimate: beat.errorEstimate,
    blocker: beat.blocker === 1,
    frameNowMs: t,
    mode,
    seq: beat.seq,
    rejectReasonOverride: codeToRejectReason(beat.kind),
  });
}

function appendBeatReclassify(
  window: PpiSampleWindow,
  beat: SessionBeat,
  mode: HrvAnalysisMode,
  t: number,
  errorEstimateMaxMs: number | undefined
): PpiSampleWindow {
  const sample = {
    ppiMs: beat.ppiMs,
    errorEstimate: beat.errorEstimate,
    blocker: beat.blocker === 1,
  };
  // Custom threshold: decide the reason up front so the retention clock
  // follows the reclassified kind too.
  const reason: PpiRejectReason =
    errorEstimateMaxMs != null &&
    isUsablePpiMs(beat.ppiMs) &&
    beat.errorEstimate != null &&
    beat.errorEstimate > errorEstimateMaxMs
      ? "quality_rejected"
      : classifyPpiRejectReason(mode, sample);
  return appendPpiSample(window, {
    ...sample,
    frameNowMs: t,
    mode,
    seq: beat.seq,
    rejectReasonOverride: reason,
  });
}

export function replaySession(
  session: IngestedSession,
  options?: {
    algoVersion?: string;
    policy?: ReplayPolicy;
    mode?: HrvAnalysisMode;
  }
): ReplayOutput {
  const algoVersion = options?.algoVersion ?? "hrv-1";
  getAlgoParams(algoVersion); // validate
  const policy: ReplayPolicy = options?.policy ?? { type: "faithful" };
  const defaultMode: HrvAnalysisMode =
    options?.mode ??
    session.metas[session.metas.length - 1]?.hrvAnalysisMode ??
    "client";

  const grouped = groupBeatsByEpochAndFrame(session.beats);
  const frames: FrameReplayResult[] = [];

  for (const [ep, byFrame] of [...grouped.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    const epochMode: HrvAnalysisMode =
      options?.mode ??
      session.metas.find((m) => m.ep === ep)?.hrvAnalysisMode ??
      defaultMode;
    let window = createEmptyPpiSampleWindow();
    let t = 1_000_000;
    const frameIds = [...byFrame.keys()].sort((a, b) => a - b);
    for (const frameId of frameIds) {
      const beats = byFrame.get(frameId) ?? [];
      for (const beat of beats) {
        if (policy.type === "faithful") {
          window = appendBeatFaithful(window, beat, epochMode, t);
        } else {
          window = appendBeatReclassify(
            window,
            beat,
            policy.mode ?? epochMode,
            t,
            policy.errorEstimateMaxMs
          );
        }
        t += Math.max(0, beat.ppiMs);
      }
      const result = computeLfHfForPpiWindow(window);
      const accepted = window.samples
        .filter((s) => s.accepted)
        .map((s) => s.ppiMs);
      const hrv =
        accepted.length >= 2 ? Math.round(calculateRMSSD(accepted)) : null;
      frames.push({
        ep,
        frameId,
        lastSeq: beats[beats.length - 1]?.seq ?? 0,
        hrv,
        lf: result.lf,
        hf: result.hf,
        lfHfRatio: result.lfHfRatio,
        status: result.status,
        correctedPpiSeries: result.correctedPpiSeries,
      });
    }
  }

  return {
    sid: session.sid,
    algoVersion,
    policy,
    frames,
  };
}

/**
 * Compare faithful replay frame results to tick-stored lfPower/hfPower.
 * Returns absolute diffs; empty when no matching ticks.
 */
export function compareReplayToTicks(
  replay: ReplayOutput,
  session: IngestedSession
): { tickIndex: number; lfDiff: number; hfDiff: number }[] {
  const diffs: { tickIndex: number; lfDiff: number; hfDiff: number }[] =
    [];
  for (let i = 0; i < session.ticks.length; i += 1) {
    const tick = session.ticks[i];
    if (tick.lfPower == null && tick.hfPower == null) continue;
    const lastBeatSeq =
      tick.beats.length > 0
        ? tick.beats[tick.beats.length - 1][0]
        : tick.windowFromSeq;
    if (lastBeatSeq == null) continue;
    // Use the latest frame whose lastSeq <= last beat in tick / window end.
    const frame = [...replay.frames]
      .reverse()
      .find((f) => f.lastSeq <= lastBeatSeq);
    if (!frame) continue;
    diffs.push({
      tickIndex: i,
      lfDiff: Math.abs((tick.lfPower ?? 0) - Math.round(frame.lf)),
      hfDiff: Math.abs((tick.hfPower ?? 0) - Math.round(frame.hf)),
    });
  }
  return diffs;
}
