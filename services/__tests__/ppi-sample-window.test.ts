import {
  acceptedPpiSeries,
  appendPpiSample,
  computeLfHfForPpiWindow,
  LF_HF_PPI_ERROR_ESTIMATE_MAX_MS,
  createEmptyPpiSampleWindow,
  isLfHfWindowReady,
  physiologicalDurationFromWindow,
  PPI_RAW_RETENTION_MAX_MS,
  PPI_RAW_RETENTION_MIN_MS,
  ppiSamplesForExport,
  slidePpiWindow,
} from "../ppi-sample-window";
import {
  computeLfHfFromTachogram,
  MIN_RESAMPLED_DURATION_SEC,
} from "../hrv-calculator";

describe("ppi-sample-window", () => {
  const baseNow = 1_000_000;

  it("conserva l'ordine e i duplicati numerici", () => {
    let w = createEmptyPpiSampleWindow();
    for (const ppi of [800, 800, 810, 800]) {
      w = appendPpiSample(w, {
        ppiMs: ppi,
        errorEstimate: 2,
        blocker: false,
        frameNowMs: baseNow,
        mode: "client",
      });
    }
    expect(acceptedPpiSeries(w)).toEqual([800, 800, 810, 800]);
  });

  it("due PPI SDK uguali consecutivi → due campioni", () => {
    let w = createEmptyPpiSampleWindow();
    w = appendPpiSample(w, {
      ppiMs: 800,
      errorEstimate: 0,
      frameNowMs: baseNow,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 800,
      errorEstimate: 0,
      frameNowMs: baseNow,
      mode: "client",
    });
    expect(w.samples).toHaveLength(2);
    expect(acceptedPpiSeries(w)).toEqual([800, 800]);
  });

  it("avanza il timestamp del PPI corrente (anche nello stesso frame)", () => {
    let w = createEmptyPpiSampleWindow();
    w = appendPpiSample(w, {
      ppiMs: 1000,
      errorEstimate: 0,
      frameNowMs: baseNow,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 1200,
      errorEstimate: 0,
      frameNowMs: baseNow,
      mode: "client",
    });
    expect(w.samples[0].timestamp).toBe(baseNow);
    expect(w.samples[1].timestamp).toBe(baseNow + 1200);
  });

  it("fuori range NON avanza l'orologio e marca out_of_physiological_range", () => {
    let w = createEmptyPpiSampleWindow();
    w = appendPpiSample(w, {
      ppiMs: 800,
      errorEstimate: 0,
      frameNowMs: baseNow,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 100,
      errorEstimate: 0,
      frameNowMs: baseNow + 50,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 900,
      errorEstimate: 0,
      frameNowMs: baseNow + 50,
      mode: "client",
    });
    expect(w.samples[1].rejectReason).toBe("out_of_physiological_range");
    expect(w.samples[1].kind).toBe("out_of_physiological_range");
    expect(w.samples[1].includedInTimeline).toBe(false);
    expect(w.samples[1].accepted).toBe(false);
    // Clock stays at first closure; out_of_range does not advance
    expect(w.samples[1].timestamp).toBe(baseNow);
    expect(w.samples[2].timestamp).toBe(baseNow + 900);
    expect(acceptedPpiSeries(w)).toEqual([800, 900]);
    expect(physiologicalDurationFromWindow(w)).toBeCloseTo(1.7, 5);
  });

  it("quality_rejected avanza; correctedPpiMs interpolato in export", () => {
    let w = createEmptyPpiSampleWindow();
    w = appendPpiSample(w, {
      ppiMs: 1250,
      errorEstimate: 2,
      frameNowMs: baseNow,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 1240,
      errorEstimate: 2,
      frameNowMs: baseNow,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 1742,
      errorEstimate: 25,
      frameNowMs: baseNow,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 1260,
      errorEstimate: 2,
      frameNowMs: baseNow,
      mode: "client",
    });
    for (let i = 0; i < 12; i++) {
      w = appendPpiSample(w, {
        ppiMs: 1250,
        errorEstimate: 2,
        frameNowMs: baseNow,
        mode: "client",
      });
    }

    expect(w.samples[2].rejectReason).toBe("quality_rejected");
    expect(w.samples[2].kind).toBe("quality_rejected");
    expect(w.samples[2].includedInTimeline).toBe(true);
    expect(w.samples[3].timestamp).toBe(baseNow + 1240 + 1742 + 1260);

    const exported = ppiSamplesForExport(w);
    expect(exported[2].correctedPpiMs).not.toBeNull();
    expect(exported[2].correctedPpiMs!).toBeLessThan(1742);
    expect(exported[2].accepted).toBe(false);

    const result = computeLfHfForPpiWindow(w);
    expect(result.includedIntervalDurationSec).toBeCloseTo(
      physiologicalDurationFromWindow(w),
      5
    );
    const recomputed = computeLfHfFromTachogram(
      result.ppiTimesSec,
      result.correctedPpiSeries
    );
    expect(Math.abs(recomputed.lf - result.lf)).toBeLessThan(1e-6);
    expect(Math.abs(recomputed.hf - result.hf)).toBeLessThan(1e-6);
  });

  it("scarta errorEstimate alto e tiene il campione in ppiSamples", () => {
    let w = createEmptyPpiSampleWindow();
    w = appendPpiSample(w, {
      ppiMs: 800,
      errorEstimate: 2,
      frameNowMs: baseNow,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 810,
      errorEstimate: 21,
      frameNowMs: baseNow,
      mode: "client",
    });
    expect(w.samples[1].rejectReason).toBe("quality_rejected");
    expect(w.samples[1].errorEstimate).toBe(21);
    expect(acceptedPpiSeries(w)).toEqual([800]);
  });

  it("LF/HF accetta errorEstimate fino a 20 ms (più largo del gate RMSSD)", () => {
    expect(LF_HF_PPI_ERROR_ESTIMATE_MAX_MS).toBe(20);
    let w = createEmptyPpiSampleWindow();
    w = appendPpiSample(w, {
      ppiMs: 800,
      errorEstimate: 15,
      frameNowMs: baseNow,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 810,
      errorEstimate: 20,
      frameNowMs: baseNow,
      mode: "client",
    });
    expect(w.samples.map((s) => s.kind)).toEqual(["accepted", "accepted"]);
  });

  it("in clinical scarta blocker come quality_rejected", () => {
    let w = createEmptyPpiSampleWindow();
    w = appendPpiSample(w, {
      ppiMs: 800,
      errorEstimate: 2,
      blocker: true,
      frameNowMs: baseNow,
      mode: "clinical",
    });
    expect(w.samples[0].rejectReason).toBe("quality_rejected");
    expect(acceptedPpiSeries(w)).toEqual([]);
  });

  it("slide rimuove campioni più vecchi di MAX retention", () => {
    const w = slidePpiWindow({
      samples: [
        {
          ppiMs: 800,
          errorEstimate: 0,
          blocker: false,
          timestamp: baseNow,
          rejectReason: null,
          kind: "accepted",
          accepted: true,
          includedInTimeline: true,
          includedInTachogram: true,
          correctedPpiMs: null,
        },
        {
          ppiMs: 810,
          errorEstimate: 0,
          blocker: false,
          timestamp: baseNow + PPI_RAW_RETENTION_MAX_MS + 1000,
          rejectReason: null,
          kind: "accepted",
          accepted: true,
          includedInTimeline: true,
          includedInTachogram: true,
          correctedPpiMs: null,
        },
      ],
      lastTimestampMs: baseNow + PPI_RAW_RETENTION_MAX_MS + 1000,
    });
    expect(w.samples).toHaveLength(1);
    expect(w.samples[0].ppiMs).toBe(810);
  });

  it("buffer con out_of_range: 310s wall non garantisce lfHfValid", () => {
    let w = createEmptyPpiSampleWindow();
    // 360 accepted * 800ms = 288s included; add 40 out_of_range (no clock)
    for (let i = 0; i < 360; i++) {
      w = appendPpiSample(w, {
        ppiMs: 800,
        errorEstimate: 1,
        frameNowMs: baseNow,
        mode: "client",
      });
      if (i % 9 === 0) {
        w = appendPpiSample(w, {
          ppiMs: 50,
          errorEstimate: 0,
          frameNowMs: baseNow,
          mode: "client",
        });
      }
    }
    const result = computeLfHfForPpiWindow(w);
    expect(result.timelineExcludedCount).toBeGreaterThan(0);
    expect(result.resampledDurationSec).toBeLessThan(MIN_RESAMPLED_DURATION_SEC);
    expect(result.valid).toBe(false);
    expect(isLfHfWindowReady(w)).toBe(false);
  });

  it("buffer più lungo → resampledDurationSec >= 300 → può validare", () => {
    let w = createEmptyPpiSampleWindow();
    for (let i = 0; i < 400; i++) {
      w = appendPpiSample(w, {
        ppiMs: 800,
        errorEstimate: 1,
        frameNowMs: baseNow,
        mode: "client",
      });
    }
    const result = computeLfHfForPpiWindow(w);
    expect(result.resampledDurationSec).toBeGreaterThanOrEqual(
      MIN_RESAMPLED_DURATION_SEC
    );
    expect(result.valid).toBe(true);
    expect(isLfHfWindowReady(w)).toBe(true);
  });

  it("retention MIN non droppa se dominio ancora < 300 (fino a MAX)", () => {
    const last = baseNow + 320_000;
    // Old sample just beyond MIN (310s) but within MAX (360s)
    const oldTs = last - 330_000;
    const samples = [
      {
        ppiMs: 800,
        errorEstimate: 0,
        blocker: false,
        timestamp: oldTs,
        rejectReason: null as null,
        kind: "accepted" as const,
        accepted: true,
        includedInTimeline: true,
        includedInTachogram: true,
        correctedPpiMs: null,
      },
      {
        ppiMs: 800,
        errorEstimate: 0,
        blocker: false,
        timestamp: last,
        rejectReason: null as null,
        kind: "accepted" as const,
        accepted: true,
        includedInTimeline: true,
        includedInTachogram: true,
        correctedPpiMs: null,
      },
    ];
    // Fill so domain from old→last is meaningful for probe — probe on atMin only
    // With only 2 samples atMin may drop old; if domain short, keep to MAX
    const w = slidePpiWindow({ samples, lastTimestampMs: last });
    // old is within MAX (360s), beyond MIN (310s): kept only if atMin domain < 300
    expect(w.samples.some((s) => s.timestamp === oldTs)).toBe(true);
    expect(PPI_RAW_RETENTION_MIN_MS).toBe(310_000);
    expect(PPI_RAW_RETENTION_MAX_MS).toBe(360_000);
  });
});
