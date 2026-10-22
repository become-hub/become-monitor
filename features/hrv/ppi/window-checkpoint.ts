/**
 * Lightweight checkpoints for verifying PPI-window integrity when replaying
 * from Ably beats. Pure helpers — no React / Ably.
 */

import type { PpiSampleWindow } from "@/features/hrv/ppi/ppi-sample-window";

/**
 * seq of the first beat currently in the LF/HF window.
 * Prefers `sample.seq` when set; otherwise uses an explicit seq list.
 */
export function windowFromSeq(
  windowOrSeqs: PpiSampleWindow | readonly number[]
): number | null {
  if (Array.isArray(windowOrSeqs)) {
    if (windowOrSeqs.length === 0) return null;
    return windowOrSeqs[0] ?? null;
  }
  const window = windowOrSeqs as PpiSampleWindow;
  const samples = window.samples;
  if (samples.length === 0) return null;
  const seq = samples[0].seq;
  return seq != null && Number.isFinite(seq) ? seq : null;
}

/** CRC32 (IEEE) of a UTF-8 string, returned as 8 lowercase hex digits. */
export function crc32Hex(input: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i);
    for (let bit = 0; bit < 8; bit += 1) {
      const lsb = crc & 1;
      crc >>>= 1;
      if (lsb) {
        crc ^= 0xedb88320;
      }
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

/**
 * Stable fingerprint of the current PPI window samples: CRC32 over
 * `ppiMs,kind` lines (kind as accepted|quality_rejected|out_of_physiological_range).
 */
export function windowCrc(window: PpiSampleWindow): string {
  const lines = window.samples.map(
    (s) => `${s.ppiMs},${s.kind}`
  );
  return crc32Hex(lines.join("\n"));
}

export function windowBeatCount(window: PpiSampleWindow): number {
  return window.samples.length;
}

export type WindowCheckpoint = {
  windowFromSeq: number | null;
  windowCrc: string;
  windowBeatCount: number;
};

/**
 * Build a checkpoint from the live window and the seq list of those samples
 * (same order as `window.samples`).
 */
export function buildWindowCheckpoint(
  window: PpiSampleWindow,
  windowSeqs?: readonly number[]
): WindowCheckpoint {
  return {
    windowFromSeq:
      windowSeqs != null ? windowFromSeq(windowSeqs) : windowFromSeq(window),
    windowCrc: windowCrc(window),
    windowBeatCount: windowBeatCount(window),
  };
}
