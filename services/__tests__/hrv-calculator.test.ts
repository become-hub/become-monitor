/**
 * Test per HRV Calculator — RMSSD + LF/HF (X raw / Y corrected / periodogram).
 */

import {
  beatClosureTimesSec,
  calculateRMSSD,
  computeLfHf,
  computeLfHfDetailed,
  computeLfHfFromIntervals,
  computeLfHfFromTachogram,
  computeLfHfProgress,
  computeOneSidedPsd,
  DEFAULT_HRV_SAMPLING_HZ,
  evaluateLfHfStatus,
  evaluateLfHfValidity,
  assessLfHfRatio,
  isLfHfPublishable,
  lfHfQualityLevel,
  MAX_ARTIFACT_GAP_SEC,
  physiologicalDurationSec,
  replaceSuccessiveJumpArtifacts,
} from "../hrv-calculator";

/**
 * Expected band power after beat-time sampling + linear interpolation to 4 Hz.
 * Continuous sinusoid of amplitude A has variance A²/2; linear interp attenuates
 * by G = sinc⁴(θ/2), θ = 2π f · RR. Hann/PSD scaling recovers variance, so
 * expected ≈ (A²/2)·G. At low HR, HF is underestimated (method bias, not a bug).
 */
function expectedInterpolatedPower(
  ampMs: number,
  freqHz: number,
  meanMs: number
): number {
  const theta = 2 * Math.PI * freqHz * (meanMs / 1000);
  const half = theta / 2;
  const g =
    Math.abs(half) < 1e-12
      ? 1
      : Math.pow(Math.sin(half) / half, 4);
  return ((ampMs * ampMs) / 2) * g;
}

/**
 * Independent LF/HF reference: does NOT use resampleUniformLinear,
 * computeOneSidedPsd, fft.js, or computeLfHfFromTachogram.
 */
function independentLfHf(
  tSec: number[],
  y: number[],
  sampleRateHz: number = DEFAULT_HRV_SAMPLING_HZ
): { lf: number; hf: number } {
  if (tSec.length < 2 || y.length !== tSec.length || sampleRateHz <= 0) {
    return { lf: 0, hf: 0 };
  }
  for (let i = 1; i < tSec.length; i++) {
    if (!(tSec[i] > tSec[i - 1])) return { lf: 0, hf: 0 };
  }

  const t0 = tSec[0];
  const tEnd = tSec[tSec.length - 1];
  const durationSec = tEnd - t0;
  if (durationSec <= 0) return { lf: 0, hf: 0 };

  const n = Math.max(2, Math.floor(durationSec * sampleRateHz) + 1);
  const series = new Array<number>(n);

  // Binary-search linear interpolation (distinct from production walk-forward)
  const interpAt = (t: number): number => {
    let lo = 0;
    let hi = tSec.length - 1;
    if (t <= tSec[0]) return y[0];
    if (t >= tSec[hi]) return y[hi];
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tSec[mid] <= t) lo = mid;
      else hi = mid;
    }
    const tA = tSec[lo];
    const tB = tSec[hi];
    const frac = (t - tA) / (tB - tA);
    return y[lo] * (1 - frac) + y[hi] * frac;
  };

  for (let i = 0; i < n; i++) {
    series[i] = interpAt(Math.min(tEnd, t0 + i / sampleRateHz));
  }

  const mean = series.reduce((a, b) => a + b, 0) / n;
  const detrended = series.map((v) => v - mean);

  let sumW2 = 0;
  const windowed = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    windowed[i] = detrended[i] * w;
    sumW2 += w * w;
  }

  let nfft = 1;
  while (nfft < n) nfft <<= 1;

  const scale = 1 / (sampleRateHz * sumW2);
  const df = sampleRateHz / nfft;
  const half = Math.floor(nfft / 2);

  let lf = 0;
  let hf = 0;
  // Direct DFT — no fft.js
  for (let k = 0; k <= half; k++) {
    let re = 0;
    let im = 0;
    const omega = (-2 * Math.PI * k) / nfft;
    for (let i = 0; i < n; i++) {
      const ang = omega * i;
      re += windowed[i] * Math.cos(ang);
      im += windowed[i] * Math.sin(ang);
    }
    let power = (re * re + im * im) * scale;
    if (k > 0 && k < half) power *= 2;
    const freq = k * df;
    if (freq >= 0.04 && freq < 0.15) lf += power * df;
    if (freq >= 0.15 && freq <= 0.4) hf += power * df;
  }

  return { lf, hf };
}

/**
 * ~5 min tachogram: RR = meanMs + amp * sin(2π f t) with real cumulative time.
 */
function synthesizeModulatedRr(
  meanMs: number,
  freqHz: number,
  ampMs: number,
  /** Included-interval sum target; domain ≈ sum − first interval. */
  targetDurationSec: number = 302
): number[] {
  const intervals: number[] = [];
  let t = 0;
  // Extra meanMs so tachogramDomainSec (last−first) still clears 300 s.
  while (t < targetDurationSec + meanMs / 1000) {
    const rr = meanMs + ampMs * Math.sin(2 * Math.PI * freqHz * t);
    const clamped = Math.max(300, Math.min(2000, rr));
    intervals.push(clamped);
    t += clamped / 1000;
  }
  return intervals;
}

function assertCloseRel(
  got: number,
  expected: number,
  relTol: number,
  absFloor: number = 1e-9
) {
  const denom = Math.max(Math.abs(expected), absFloor);
  expect(Math.abs(got - expected) / denom).toBeLessThan(relTol);
}

/**
 * Parseval-style check: ∫ PSD df ≈ Σ(windowed²) / Σ(w²)
 * (density scale 1/(fs·Σw²) + one-sided doubling).
 */
function parsevalRelativeError(
  series: number[],
  sampleRateHz: number
): number {
  const { psd, df, detrended } = computeOneSidedPsd(series, sampleRateHz);
  const n = detrended.length;
  const w = new Float64Array(n);
  let sumW2 = 0;
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    sumW2 += w[i] * w[i];
  }
  let timePower = 0;
  for (let i = 0; i < n; i++) {
    const v = detrended[i] * w[i];
    timePower += v * v;
  }
  timePower /= sumW2;
  let freqPower = 0;
  for (let k = 0; k < psd.length; k++) {
    freqPower += psd[k] * df;
  }
  return Math.abs(freqPower - timePower) / Math.max(timePower, 1e-12);
}

describe("HRV Calculator", () => {
  describe("calculateRMSSD", () => {
    it("calcola correttamente RMSSD per valori stabili", () => {
      expect(calculateRMSSD([800, 800, 800, 800, 800])).toBe(0);
    });

    it("calcola RMSSD per valori variabili", () => {
      const rmssd = calculateRMSSD([800, 820, 810, 830, 805]);
      expect(rmssd).toBeGreaterThan(0);
      expect(rmssd).toBeLessThan(50);
    });

    it("filtra artefatti grandi (>200ms)", () => {
      expect(calculateRMSSD([800, 1100, 820, 810])).toBeDefined();
    });

    it("restituisce 0 per finestra troppo piccola", () => {
      expect(calculateRMSSD([800])).toBe(0);
    });
  });

  describe("timeline fisiologica (X da raw)", () => {
    it("closure times da intervalli reali (non 1 Hz)", () => {
      const ppi = [1270, 1250, 1290, 1240];
      expect(beatClosureTimesSec(ppi)).toEqual([1.27, 2.52, 3.81, 5.05]);
      expect(physiologicalDurationSec(ppi)).toBeCloseTo(5.05, 5);
    });

    it("ppiTimesSec monotono; resampledDuration = last-first", () => {
      const ppi = Array.from({ length: 40 }, () => 1000);
      const detailed = computeLfHfDetailed(ppi);
      expect(detailed.ppiTimesSec.length).toBe(ppi.length);
      for (let i = 1; i < detailed.ppiTimesSec.length; i++) {
        expect(detailed.ppiTimesSec[i]).toBeGreaterThan(
          detailed.ppiTimesSec[i - 1]
        );
      }
      expect(detailed.resampledDurationSec).toBeCloseTo(
        detailed.ppiTimesSec[detailed.ppiTimesSec.length - 1] -
          detailed.ppiTimesSec[0],
        8
      );
      const expected =
        Math.floor(detailed.resampledDurationSec * 4) + 1;
      expect(detailed.resampledPointCount).toBe(expected);
    });

    it("out_of_physiological_range escluso da X (nessun timestamp duplicato)", () => {
      const result = computeLfHfFromIntervals([
        { ppiMs: 800, kind: "accepted" },
        { ppiMs: 100, kind: "out_of_physiological_range" },
        { ppiMs: 900, kind: "accepted" },
        ...Array.from({ length: 12 }, () => ({
          ppiMs: 800,
          kind: "accepted" as const,
        })),
      ]);
      expect(result.timelineExcludedCount).toBe(1);
      expect(result.rawIncludedPpiMs).not.toContain(100);
      expect(result.ppiTimesSec.every((t, i, a) => i === 0 || t > a[i - 1])).toBe(
        true
      );
      expect(result.includedIntervalDurationSec).toBeCloseTo(
        (800 + 900 + 12 * 800) / 1000,
        5
      );
    });
  });

  describe("computeLfHf — test sintetici obbligatori", () => {
    it("TEST HF: modulazione 0.25 Hz → potenza principalmente in HF", () => {
      const series = synthesizeModulatedRr(1200, 0.25, 40);
      const result = computeLfHfDetailed(series);
      expect(result.resampledDurationSec).toBeGreaterThanOrEqual(300);
      expect(result.valid).toBe(true);
      expect(result.hf).toBeGreaterThan(result.lf);
      expect(result.peakFrequencyHz).not.toBeNull();
      expect(Math.abs(result.peakFrequencyHz! - 0.25)).toBeLessThan(0.05);
    });

    it("TEST LF: modulazione 0.10 Hz → potenza principalmente in LF", () => {
      const series = synthesizeModulatedRr(1200, 0.1, 40);
      const result = computeLfHfDetailed(series);
      expect(result.valid).toBe(true);
      expect(result.lf).toBeGreaterThan(result.hf);
      expect(result.peakFrequencyHz).not.toBeNull();
      expect(Math.abs(result.peakFrequencyHz! - 0.1)).toBeLessThan(0.04);
    });

    it("TEST asse: picco non scalato come se i beat fossero a 1 Hz", () => {
      const series = synthesizeModulatedRr(1250, 0.25, 50);
      const result = computeLfHfDetailed(series);
      expect(result.peakFrequencyHz).not.toBeNull();
      const peak = result.peakFrequencyHz!;
      expect(Math.abs(peak - 0.25)).toBeLessThan(0.05);
      expect(Math.abs(peak - 0.2)).toBeGreaterThan(0.02);
    });

    it("export coerente: computeLfHfFromTachogram ≡ interno (non è riferimento indipendente)", () => {
      const series = synthesizeModulatedRr(1000, 0.15, 30, 120);
      const detailed = computeLfHfDetailed(series);
      const recomputed = computeLfHfFromTachogram(
        detailed.ppiTimesSec,
        detailed.correctedPpiSeries
      );
      expect(Math.abs(recomputed.lf - detailed.lf)).toBeLessThan(1e-6);
      expect(Math.abs(recomputed.hf - detailed.hf)).toBeLessThan(1e-6);
    });

    it("unità ms²: potenza sinusoidale finisce nella banda attesa (non zero)", () => {
      const series = synthesizeModulatedRr(1000, 0.25, 60);
      const { lf, hf } = computeLfHf(series);
      expect(lf + hf).toBeGreaterThan(100);
      expect(hf / (lf + hf)).toBeGreaterThan(0.6);
    });

    it("Parseval: energia tempo ≈ integrale PSD one-sided", () => {
      const series = synthesizeModulatedRr(1000, 0.25, 50, 60);
      const detailed = computeLfHfDetailed(series);
      expect(
        parsevalRelativeError(detailed.resampledSeries, DEFAULT_HRV_SAMPLING_HZ)
      ).toBeLessThan(0.05);
    });

    it("bin 0.15 Hz conta solo in HF (LF f < 0.15)", () => {
      // Inject energy near 0.15 via long stable series + check band edges
      const series = synthesizeModulatedRr(1000, 0.15, 40, 120);
      const result = computeLfHfDetailed(series);
      // Peak should land in HF band; LF should not dominate at exact 0.15
      expect(result.hf).toBeGreaterThan(0);
      if (result.peakFrequencyHz != null) {
        expect(result.peakFrequencyHz).toBeGreaterThanOrEqual(0.14);
      }
    });
  });

  describe("quality_rejected vs out_of_range + ricalcolo", () => {
    it("quality-rejected raw≠corrected → computeLfHfFromTachogram ≡ pipeline", () => {
      const intervals = [
        { ppiMs: 1250, kind: "accepted" as const },
        { ppiMs: 1240, kind: "accepted" as const },
        { ppiMs: 1742, kind: "quality_rejected" as const },
        { ppiMs: 1260, kind: "accepted" as const },
        ...Array.from({ length: 20 }, () => ({
          ppiMs: 1250,
          kind: "accepted" as const,
        })),
      ];
      const result = computeLfHfFromIntervals(intervals);
      expect(result.rawIncludedPpiMs[2]).toBe(1742);
      expect(result.correctedPpiSeries[2]).not.toBe(1742);
      expect(result.tachogramSamples[2].kind).toBe("quality_rejected");
      expect(result.tachogramSamples[2].rawPpiMs).not.toBe(
        result.tachogramSamples[2].correctedPpiMs
      );

      const recomputed = computeLfHfFromTachogram(
        result.ppiTimesSec,
        result.correctedPpiSeries
      );
      expect(Math.abs(recomputed.lf - result.lf)).toBeLessThan(1e-6);
      expect(Math.abs(recomputed.hf - result.hf)).toBeLessThan(1e-6);
    });

    it("maxArtifactGapSec > 5 → invalid", () => {
      const intervals = [
        ...Array.from({ length: 100 }, () => ({
          ppiMs: 800,
          kind: "accepted" as const,
        })),
        // ~6 s of quality_rejected
        ...Array.from({ length: 8 }, () => ({
          ppiMs: 800,
          kind: "quality_rejected" as const,
        })),
        ...Array.from({ length: 280 }, () => ({
          ppiMs: 800,
          kind: "accepted" as const,
        })),
      ];
      const result = computeLfHfFromIntervals(intervals);
      expect(result.maxArtifactGapSec).toBeGreaterThan(MAX_ARTIFACT_GAP_SEC);
      expect(result.valid).toBe(false);
    });

    it("acceptedRatio < 0.75 → invalid", () => {
      const intervals = [
        ...Array.from({ length: 100 }, () => ({
          ppiMs: 800,
          kind: "accepted" as const,
        })),
        ...Array.from({ length: 50 }, () => ({
          ppiMs: 800,
          kind: "quality_rejected" as const,
        })),
        ...Array.from({ length: 230 }, () => ({
          ppiMs: 800,
          kind: "accepted" as const,
        })),
      ];
      const result = computeLfHfFromIntervals(intervals);
      // 330 accepted / 380 total ≈ 0.868 — need worse
      const bad = computeLfHfFromIntervals([
        ...Array.from({ length: 150 }, () => ({
          ppiMs: 800,
          kind: "accepted" as const,
        })),
        ...Array.from({ length: 250 }, () => ({
          ppiMs: 800,
          kind: "quality_rejected" as const,
        })),
      ]);
      expect(bad.acceptedRatio).toBeLessThan(0.75);
      expect(bad.valid).toBe(false);
      expect(result.acceptedRatio).toBeGreaterThan(0.75);
    });
  });

  /**
   * Amplitude vs theory: linear-interp attenuation G = sinc⁴(θ/2).
   * At low HR, HF is underestimated vs continuous sinusoid (method bias).
   */
  describe("ampiezza attesa", () => {
    it("HF 0.25 Hz @ 1200 ms: potenza ≈ (A²/2)·G entro 3%", () => {
      const meanMs = 1200;
      const ampMs = 40;
      const freqHz = 0.25;
      const expected = expectedInterpolatedPower(ampMs, freqHz, meanMs);
      const result = computeLfHfDetailed(
        synthesizeModulatedRr(meanMs, freqHz, ampMs)
      );
      assertCloseRel(result.hf, expected, 0.03);
      expect(result.lf).toBeLessThan(result.hf * 0.01);
    });

    it("LF 0.10 Hz @ 1200 ms: potenza ≈ (A²/2)·G entro 3%", () => {
      const meanMs = 1200;
      const ampMs = 40;
      const freqHz = 0.1;
      const expected = expectedInterpolatedPower(ampMs, freqHz, meanMs);
      const result = computeLfHfDetailed(
        synthesizeModulatedRr(meanMs, freqHz, ampMs)
      );
      assertCloseRel(result.lf, expected, 0.03);
      expect(result.hf).toBeLessThan(result.lf * 0.01);
    });

    it("HF 0.25 Hz @ 857 ms (~70 bpm): potenza ≈ (A²/2)·G entro 3%", () => {
      const meanMs = 857;
      const ampMs = 40;
      const freqHz = 0.25;
      const expected = expectedInterpolatedPower(ampMs, freqHz, meanMs);
      const result = computeLfHfDetailed(
        synthesizeModulatedRr(meanMs, freqHz, ampMs)
      );
      assertCloseRel(result.hf, expected, 0.03);
      expect(result.lf).toBeLessThan(result.hf * 0.01);
    });
  });

  describe("riferimento indipendente (DFT diretto)", () => {
    it("HF sintetico: pipeline ≡ independentLfHf entro 1e-9 relativo", () => {
      const series = synthesizeModulatedRr(1200, 0.25, 40);
      const result = computeLfHfDetailed(series);
      const ref = independentLfHf(
        result.ppiTimesSec,
        result.correctedPpiSeries
      );
      assertCloseRel(result.lf, ref.lf, 1e-9, 1e-12);
      assertCloseRel(result.hf, ref.hf, 1e-9, 1e-12);
    });

    it("LF sintetico: pipeline ≡ independentLfHf entro 1e-9 relativo", () => {
      const series = synthesizeModulatedRr(1200, 0.1, 40);
      const result = computeLfHfDetailed(series);
      const ref = independentLfHf(
        result.ppiTimesSec,
        result.correctedPpiSeries
      );
      assertCloseRel(result.lf, ref.lf, 1e-9, 1e-12);
      assertCloseRel(result.hf, ref.hf, 1e-9, 1e-12);
    });

    it("quality_rejected + out_of_range: export X/Y ≡ independentLfHf", () => {
      const base = synthesizeModulatedRr(1000, 0.25, 40, 120);
      const intervals = base.map((ppiMs, i) => {
        if (i === 40) {
          return { ppiMs: 100, kind: "out_of_physiological_range" as const };
        }
        if (i === 80) {
          return { ppiMs: 1742, kind: "quality_rejected" as const };
        }
        return { ppiMs, kind: "accepted" as const };
      });
      const result = computeLfHfFromIntervals(intervals);
      expect(result.timelineExcludedCount).toBe(1);
      expect(result.correctedPpiCount).toBeGreaterThan(0);
      const ref = independentLfHf(
        result.ppiTimesSec,
        result.correctedPpiSeries
      );
      assertCloseRel(result.lf, ref.lf, 1e-9, 1e-12);
      assertCloseRel(result.hf, ref.hf, 1e-9, 1e-12);
    });
  });

  describe("lfHfValid su resampledDurationSec", () => {
    it("evaluateLfHfValidity richiede resampledDurationSec >= 300", () => {
      expect(
        evaluateLfHfValidity({
          resampledDurationSec: 299,
          acceptedPpiCount: 200,
          acceptedRatio: 1,
          maxArtifactGapSec: 0,
          ppiTimesSec: [1, 300],
          resampledLength: 100,
          lf: 1,
          hf: 1,
        })
      ).toBe(false);
      expect(
        evaluateLfHfValidity({
          resampledDurationSec: 300,
          acceptedPpiCount: 200,
          acceptedRatio: 1,
          maxArtifactGapSec: 0,
          ppiTimesSec: [1, 301],
          resampledLength: 100,
          lf: 1,
          hf: 1,
        })
      ).toBe(true);
    });
  });

  it("lfHfQualityLevel: bassa / media / ottima", () => {
    expect(lfHfQualityLevel("unavailable")).toBe(0);
    expect(lfHfQualityLevel("low_quality")).toBe(1);
    expect(lfHfQualityLevel("warming_up")).toBe(1);
    expect(lfHfQualityLevel("provisional")).toBe(2);
    expect(lfHfQualityLevel("valid")).toBe(3);
  });

  it("assessLfHfRatio: fasce di plausibilità", () => {
    expect(assessLfHfRatio(null)).toBeNull();
    expect(assessLfHfRatio(0.1)?.severity).toBe("warn");
    expect(assessLfHfRatio(2.5)?.label).toBe("plausibile");
    expect(assessLfHfRatio(7)?.severity).toBe("warn");
    expect(assessLfHfRatio(15)?.severity).toBe("danger");
    expect(assessLfHfRatio(30)?.label).toBe("sospetto");
    expect(assessLfHfRatio(80)?.label).toBe("probabile artefatto");
  });

  describe("computeLfHfProgress", () => {
    it("low_quality: punta a provisional e la barra segue il requisito peggiore", () => {
      const p = computeLfHfProgress({
        status: "low_quality",
        acceptedRatio: 0.3,
        maxArtifactGapSec: 20,
        resampledDurationSec: 146,
      });
      expect(p.nextStatus).toBe("provisional");
      const byKey = Object.fromEntries(p.requirements.map((r) => [r.key, r]));
      expect(byKey.acceptedRatio.progress).toBeCloseTo(0.5, 6);
      expect(byKey.acceptedRatio.met).toBe(false);
      expect(byKey.maxArtifactGapSec.progress).toBeCloseTo(0.5, 6);
      expect(byKey.duration.met).toBe(true);
      expect(p.overall).toBeCloseTo(0.5, 6);
    });

    it("provisional: soglie strette verso valid", () => {
      const p = computeLfHfProgress({
        status: "provisional",
        acceptedRatio: 0.9,
        maxArtifactGapSec: 2,
        resampledDurationSec: 150,
      });
      expect(p.nextStatus).toBe("valid");
      expect(p.requirements.find((r) => r.key === "duration")?.target).toBe(300);
      expect(p.requirements.find((r) => r.key === "acceptedRatio")?.target).toBe(0.75);
      expect(p.overall).toBeCloseTo(0.5, 6);
    });

    it("valid: nessun livello successivo", () => {
      const p = computeLfHfProgress({
        status: "valid",
        acceptedRatio: 0.9,
        maxArtifactGapSec: 1,
        resampledDurationSec: 300,
      });
      expect(p.nextStatus).toBeNull();
      expect(p.overall).toBe(1);
    });
  });

  describe("lfHfStatus (grado di fiducia LF/HF live)", () => {
    const base = {
      valid: false,
      acceptedRatio: 0.65,
      maxArtifactGapSec: 5.3,
      lf: 100,
      hf: 50,
    };

    it("nessuno spettro → unavailable; < 120 s → warming_up; ≥ 120 s → provisional", () => {
      expect(evaluateLfHfStatus({ ...base, resampledDurationSec: 0 })).toBe(
        "unavailable"
      );
      expect(evaluateLfHfStatus({ ...base, resampledDurationSec: 10 })).toBe(
        "warming_up"
      );
      expect(evaluateLfHfStatus({ ...base, resampledDurationSec: 119 })).toBe(
        "warming_up"
      );
      expect(evaluateLfHfStatus({ ...base, resampledDurationSec: 120 })).toBe(
        "provisional"
      );
    });

    it("qualità sotto i gate live → low_quality (valori comunque pubblicabili)", () => {
      const sessionLike = {
        ...base,
        acceptedRatio: 0.541,
        maxArtifactGapSec: 17.55,
        resampledDurationSec: 244.6,
      };
      expect(evaluateLfHfStatus(sessionLike)).toBe("low_quality");
      expect(
        evaluateLfHfStatus({ ...base, maxArtifactGapSec: 10.5, resampledDurationSec: 30 })
      ).toBe("low_quality");
      expect(isLfHfPublishable("low_quality")).toBe(true);
    });

    it("valid stretto → valid; solo unavailable non pubblicabile", () => {
      expect(
        evaluateLfHfStatus({ ...base, valid: true, resampledDurationSec: 300 })
      ).toBe("valid");
      expect(isLfHfPublishable("warming_up")).toBe(true);
      expect(isLfHfPublishable("provisional")).toBe(true);
      expect(isLfHfPublishable("unavailable")).toBe(false);
    });

    it("finestra sintetica di ~130 s → provisional con LF/HF finiti", () => {
      const intervals: number[] = [];
      let t = 0;
      while (t < 131) {
        const rr =
          900 +
          30 * Math.sin(2 * Math.PI * 0.1 * t) +
          20 * Math.sin(2 * Math.PI * 0.25 * t);
        intervals.push(rr);
        t += rr / 1000;
      }
      const result = computeLfHfDetailed(intervals);
      expect(result.valid).toBe(false);
      expect(result.status).toBe("provisional");
      expect(result.lf).toBeGreaterThan(0);
      expect(result.hf).toBeGreaterThan(0);
    });
  });

  describe("replaceSuccessiveJumpArtifacts", () => {
    it("interpola salti ≥ 200 ms", () => {
      const cleaned = replaceSuccessiveJumpArtifacts([
        800, 820, 1100, 810, 815, 820, 805, 812, 818, 822, 808, 816,
      ]);
      expect(cleaned).not.toBeNull();
      expect(Math.abs(cleaned![2] - 1100)).toBeGreaterThan(50);
    });

    it("ritorna null sotto 2 ancore", () => {
      expect(
        replaceSuccessiveJumpArtifacts([800, 1100, 1400, 1700])
      ).toBeNull();
    });
  });

  describe("computeOneSidedPsd", () => {
    it("raddoppia i bin positivi (non DC)", () => {
      const series = Array.from(
        { length: 64 },
        (_, i) => Math.sin((2 * Math.PI * 4 * i) / 64)
      );
      const { psd, freqs } = computeOneSidedPsd(series, 4);
      expect(psd.length).toBeGreaterThan(2);
      expect(freqs[0]).toBe(0);
      expect(psd.some((p) => p > 0)).toBe(true);
    });
  });

  describe("regressione API computeLfHf", () => {
    it("produce LF/HF ≥ 0 su serie corta (valid=false)", () => {
      const { lf, hf } = computeLfHf([800, 820, 810]);
      expect(lf).toBeGreaterThanOrEqual(0);
      expect(hf).toBeGreaterThanOrEqual(0);
      expect(computeLfHfDetailed([800, 820, 810]).valid).toBe(false);
    });

    it("produce LF/HF ≥ 0 su serie stabile lunga", () => {
      const ppi = Array.from({ length: 60 }, () => 800);
      const { lf, hf } = computeLfHf(ppi);
      expect(lf).toBeGreaterThanOrEqual(0);
      expect(hf).toBeGreaterThanOrEqual(0);
    });
  });
});
