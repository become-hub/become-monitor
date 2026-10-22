/**
 * Session-scoped PPI beat outbox for Ably delta publishing.
 * Survives PPI window resets (epoch bumps); drained only on Ably ack.
 */

import type { LfHfIntervalKind } from "@/features/hrv/core/hrv-calculator";

/** 0 = accepted, 1 = quality_rejected, 2 = out_of_physiological_range. */
export type PolarBeatKindCode = 0 | 1 | 2;

/**
 * Beat tuple columns (see sessionMeta.beatsColumns):
 * [seq, ppiMs, errorEstimate, kind, blocker, ep, frameId]
 */
export type PolarBeatTuple = [
  seq: number,
  ppiMs: number,
  errorEstimate: number | null,
  kind: PolarBeatKindCode,
  blocker: 0 | 1,
  ep: number,
  frameId: number,
];

export type BeatOutbox = {
  /** Monotonic per session; never reset by window slide / epoch. */
  nextSeq: number;
  /** Epoch counter; +1 on each PPI window reset. */
  ep: number;
  /** Frame counter; +1 on each Polar PPI frame. */
  frameId: number;
  /** Beats not yet acked by Ably (sent or not). */
  pending: PolarBeatTuple[];
  /**
   * Highest seq already handed to Ably (publish in flight or acked).
   * `selectPending` returns only beats above it, so an outage does not
   * re-send the same beats in every queued tick. Rewound by `nackFrom`.
   */
  inFlightUpTo: number;
};

export const DEFAULT_BEAT_OUTBOX_CAP = 120;

export function createBeatOutbox(): BeatOutbox {
  return {
    nextSeq: 1,
    ep: 1,
    frameId: 0,
    pending: [],
    inFlightUpTo: 0,
  };
}

export function kindToCode(kind: LfHfIntervalKind): PolarBeatKindCode {
  if (kind === "accepted") return 0;
  if (kind === "quality_rejected") return 1;
  return 2;
}

/** Reject reason matching a stored beat kind code (offline replay). */
export function codeToRejectReason(
  code: PolarBeatKindCode
): "quality_rejected" | "out_of_physiological_range" | null {
  if (code === 0) return null;
  if (code === 1) return "quality_rejected";
  return "out_of_physiological_range";
}

export function codeToKind(code: PolarBeatKindCode): LfHfIntervalKind {
  if (code === 0) return "accepted";
  if (code === 1) return "quality_rejected";
  return "out_of_physiological_range";
}

/** Advance frameId for a new Polar PPI frame (call once per handlePpiData). */
export function nextFrame(outbox: BeatOutbox): BeatOutbox {
  return { ...outbox, frameId: outbox.frameId + 1 };
}

/** Bump epoch after a PPI window reset. Does not clear pending beats. */
export function bumpEpoch(outbox: BeatOutbox): BeatOutbox {
  return { ...outbox, ep: outbox.ep + 1 };
}

export function pushBeat(
  outbox: BeatOutbox,
  input: {
    ppiMs: number;
    errorEstimate: number | null;
    kind: LfHfIntervalKind;
    blocker: boolean | null;
  }
): { outbox: BeatOutbox; seq: number } {
  const seq = outbox.nextSeq;
  const tuple: PolarBeatTuple = [
    seq,
    input.ppiMs,
    input.errorEstimate,
    kindToCode(input.kind),
    input.blocker === true ? 1 : 0,
    outbox.ep,
    outbox.frameId,
  ];
  return {
    seq,
    outbox: {
      ...outbox,
      nextSeq: seq + 1,
      pending: [...outbox.pending, tuple],
    },
  };
}

/**
 * Beats not yet handed to Ably (seq > inFlightUpTo), up to `max`, oldest
 * first. Does not mutate the outbox.
 */
export function selectPending(
  outbox: BeatOutbox,
  max: number = DEFAULT_BEAT_OUTBOX_CAP
): PolarBeatTuple[] {
  if (max <= 0 || outbox.pending.length === 0) {
    return [];
  }
  return outbox.pending
    .filter((b) => b[0] > outbox.inFlightUpTo)
    .slice(0, max);
}

/** Mark beats up to `upToSeq` as handed to Ably (publish started). */
export function markInFlight(
  outbox: BeatOutbox,
  upToSeq: number
): BeatOutbox {
  if (!Number.isFinite(upToSeq) || upToSeq <= outbox.inFlightUpTo) {
    return outbox;
  }
  return { ...outbox, inFlightUpTo: upToSeq };
}

/**
 * A publish carrying beats from `fromSeq` was dropped/rejected: make those
 * beats selectable again (they are still in `pending`).
 */
export function nackFrom(outbox: BeatOutbox, fromSeq: number): BeatOutbox {
  const rewound = Math.min(outbox.inFlightUpTo, fromSeq - 1);
  if (rewound === outbox.inFlightUpTo) {
    return outbox;
  }
  return { ...outbox, inFlightUpTo: rewound };
}

/**
 * Drop pending beats with seq <= upToSeq (inclusive) after Ably ack.
 * Beats with higher seq stay for the next tick.
 */
export function ackUpTo(outbox: BeatOutbox, upToSeq: number): BeatOutbox {
  if (!Number.isFinite(upToSeq) || outbox.pending.length === 0) {
    return outbox;
  }
  return {
    ...outbox,
    pending: outbox.pending.filter((b) => b[0] > upToSeq),
  };
}

/** Last seq currently pending, or null if empty. */
export function lastPendingSeq(outbox: BeatOutbox): number | null {
  if (outbox.pending.length === 0) {
    return null;
  }
  return outbox.pending[outbox.pending.length - 1][0];
}
