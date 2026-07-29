/**
 * RR intervals from Polar PPI (preferred) or HR (derived).
 * HR → RR(ms) = 60000 / HR(bpm)
 */

export type RrSource = "ppi" | "hr_derived";

export function rrFromHr(hrBpm: number): number | null {
  if (!Number.isFinite(hrBpm) || hrBpm <= 0) {
    return null;
  }
  return Math.round(60000 / hrBpm);
}

export function rrFromPpi(ppiMs: number): number | null {
  if (!Number.isFinite(ppiMs) || ppiMs <= 0) {
    return null;
  }
  return Math.round(ppiMs);
}

export function resolveRrInterval(input: {
  ppiMs?: number | null;
  hrBpm?: number | null;
}): { rrMs: number; rrSource: RrSource } | null {
  if (input.ppiMs != null && input.ppiMs > 0) {
    const rrMs = rrFromPpi(input.ppiMs);
    if (rrMs != null) {
      return { rrMs, rrSource: "ppi" };
    }
  }
  if (input.hrBpm != null && input.hrBpm > 0) {
    const rrMs = rrFromHr(input.hrBpm);
    if (rrMs != null) {
      return { rrMs, rrSource: "hr_derived" };
    }
  }
  return null;
}
