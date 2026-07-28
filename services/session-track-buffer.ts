/**
 * In-memory live PPI/RR track buffer (fallback when Polar offline recording fails).
 */

import { resolveRrInterval, RrSource } from "./rr-interval";

export interface TrackSample {
  t: string;
  ppiMs?: number;
  hr?: number;
  errorEstimate?: number;
  blockerBit?: boolean;
  rrMs: number;
  rrSource: RrSource;
}

export class SessionTrackBuffer {
  private samples: TrackSample[] = [];
  private startedAt: string | null = null;

  clear(): void {
    this.samples = [];
    this.startedAt = null;
  }

  getStartedAt(): string | null {
    return this.startedAt;
  }

  getLength(): number {
    return this.samples.length;
  }

  getSamples(): TrackSample[] {
    return [...this.samples];
  }

  pushPpi(input: {
    ppiMs: number;
    hr?: number;
    errorEstimate?: number;
    blockerBit?: boolean;
    t?: string;
  }): TrackSample | null {
    const resolved = resolveRrInterval({
      ppiMs: input.ppiMs,
      hrBpm: input.hr,
    });
    if (!resolved) {
      return null;
    }
    const t = input.t ?? new Date().toISOString();
    if (!this.startedAt) {
      this.startedAt = t;
    }
    const sample: TrackSample = {
      t,
      ppiMs: input.ppiMs,
      hr: input.hr,
      errorEstimate: input.errorEstimate,
      blockerBit: input.blockerBit,
      rrMs: resolved.rrMs,
      rrSource: resolved.rrSource,
    };
    this.samples.push(sample);
    return sample;
  }

  pushHr(hrBpm: number, t?: string): TrackSample | null {
    const resolved = resolveRrInterval({ hrBpm });
    if (!resolved) {
      return null;
    }
    const stamp = t ?? new Date().toISOString();
    if (!this.startedAt) {
      this.startedAt = stamp;
    }
    const sample: TrackSample = {
      t: stamp,
      hr: hrBpm,
      rrMs: resolved.rrMs,
      rrSource: resolved.rrSource,
    };
    this.samples.push(sample);
    return sample;
  }
}

export const sessionTrackBuffer = new SessionTrackBuffer();
