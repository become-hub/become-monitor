import {
  acceptHrvIntervalSample,
  beginNextClinicalEpoch,
  CLIENT_WINDOW_INTERVALS,
  CLINICAL_ACQUISITION_TIMEOUT_MS,
  CLINICAL_EPOCH_TARGET_MS,
  createEmptyHrvEpochAccumulator,
  formatDurationMmSs,
  formatHrvProgressLabel,
  getHrvAnalysisPolicy,
  hrvProgressPercent,
  hrvWallElapsedMs,
  isHrvAcquisitionTimedOut,
  markHrvAcquisitionStarted,
  pushHrvInterval,
} from "../hrv-analysis-mode";
import { PPI_ERROR_ESTIMATE_SANE_MS } from "../polar-live-signal";

describe("hrv-analysis-mode", () => {
  describe("getHrvAnalysisPolicy", () => {
    it("live: finestra 30 beat, HR-derived consentito su PPI", () => {
      const policy = getHrvAnalysisPolicy("client", "ppi");
      expect(policy.windowIntervalCount).toBe(CLIENT_WINDOW_INTERVALS);
      expect(policy.epochTargetMs).toBeNull();
      expect(policy.allowHrDerived).toBe(true);
    });

    it("live H10: HR-derived non serve (solo ECG RR)", () => {
      expect(getHrvAnalysisPolicy("client", "ecg_rr").allowHrDerived).toBe(
        false
      );
    });

    it("estesa: epoch 5 min e timeout acquisizione, niente HR-derived", () => {
      const policy = getHrvAnalysisPolicy("clinical", "ppi");
      expect(policy.windowIntervalCount).toBeNull();
      expect(policy.epochTargetMs).toBe(CLINICAL_EPOCH_TARGET_MS);
      expect(policy.acquisitionTimeoutMs).toBe(CLINICAL_ACQUISITION_TIMEOUT_MS);
      expect(policy.allowHrDerived).toBe(false);
    });
  });

  describe("acceptHrvIntervalSample", () => {
    it("scarta fuori range per ogni sorgente", () => {
      expect(
        acceptHrvIntervalSample("client", "ppi", { intervalMs: 100 })
      ).toBe(false);
      expect(
        acceptHrvIntervalSample("client", "ecg_rr", { intervalMs: 2500 })
      ).toBe(false);
    });

    it("PPI live: richiede errorEstimate ≤ soglia sana", () => {
      expect(
        acceptHrvIntervalSample("client", "ppi", {
          intervalMs: 800,
          errorEstimate: PPI_ERROR_ESTIMATE_SANE_MS,
        })
      ).toBe(true);
      expect(
        acceptHrvIntervalSample("client", "ppi", {
          intervalMs: 800,
          errorEstimate: PPI_ERROR_ESTIMATE_SANE_MS + 1,
        })
      ).toBe(false);
    });

    it("PPI estesa: scarta anche con blocker attivo", () => {
      expect(
        acceptHrvIntervalSample("clinical", "ppi", {
          intervalMs: 800,
          errorEstimate: 5,
          blocker: false,
        })
      ).toBe(true);
      expect(
        acceptHrvIntervalSample("clinical", "ppi", {
          intervalMs: 800,
          errorEstimate: 5,
          blocker: true,
        })
      ).toBe(false);
      // Live tollera blocker se errorEstimate è sano
      expect(
        acceptHrvIntervalSample("client", "ppi", {
          intervalMs: 800,
          errorEstimate: 5,
          blocker: true,
        })
      ).toBe(true);
    });

    it("ECG RR: accetta in range senza gate errorEstimate", () => {
      expect(
        acceptHrvIntervalSample("clinical", "ecg_rr", {
          intervalMs: 900,
          errorEstimate: 50,
          blocker: true,
        })
      ).toBe(true);
    });

    it("HR-derived solo in modalità live", () => {
      expect(
        acceptHrvIntervalSample("client", "hr_derived", { intervalMs: 857 })
      ).toBe(true);
      expect(
        acceptHrvIntervalSample("clinical", "hr_derived", { intervalMs: 857 })
      ).toBe(false);
    });
  });

  describe("pushHrvInterval", () => {
    it("live: calcola a 30 intervalli e mantiene finestra scorrevole", () => {
      let acc = createEmptyHrvEpochAccumulator();
      const policy = getHrvAnalysisPolicy("client", "ppi");
      let shouldCompute = false;
      for (let i = 0; i < CLIENT_WINDOW_INTERVALS; i++) {
        const result = pushHrvInterval(acc, policy, 800, 1000 + i);
        acc = result.accumulator;
        shouldCompute = result.shouldCompute;
      }
      expect(shouldCompute).toBe(true);
      expect(acc.intervals).toHaveLength(CLIENT_WINDOW_INTERVALS);

      const next = pushHrvInterval(acc, policy, 810, 2000);
      expect(next.accumulator.intervals).toHaveLength(CLIENT_WINDOW_INTERVALS);
      expect(next.accumulator.intervals[CLIENT_WINDOW_INTERVALS - 1]).toBe(810);
      expect(next.shouldCompute).toBe(true);
    });

    it("estesa: calcola solo a ≥ 5 min di durata accettata", () => {
      let acc = createEmptyHrvEpochAccumulator();
      const policy = getHrvAnalysisPolicy("clinical", "ecg_rr");
      const intervalMs = 1000;
      const need = Math.ceil(CLINICAL_EPOCH_TARGET_MS / intervalMs);
      let last = pushHrvInterval(acc, policy, intervalMs, 0);
      acc = last.accumulator;
      expect(last.shouldCompute).toBe(false);

      for (let i = 1; i < need - 1; i++) {
        last = pushHrvInterval(acc, policy, intervalMs, i * 1000);
        acc = last.accumulator;
      }
      expect(last.shouldCompute).toBe(false);
      expect(acc.acceptedDurationMs).toBeLessThan(CLINICAL_EPOCH_TARGET_MS);

      last = pushHrvInterval(acc, policy, intervalMs, need * 1000);
      expect(last.shouldCompute).toBe(true);
      expect(last.accumulator.acceptedDurationMs).toBeGreaterThanOrEqual(
        CLINICAL_EPOCH_TARGET_MS
      );
    });

    it("estesa: timeout acquisizione resetta senza compute", () => {
      const policy = getHrvAnalysisPolicy("clinical", "ppi");
      let acc = createEmptyHrvEpochAccumulator();
      acc = pushHrvInterval(acc, policy, 800, 0).accumulator;
      const timedOut = pushHrvInterval(
        acc,
        policy,
        800,
        CLINICAL_ACQUISITION_TIMEOUT_MS
      );
      expect(timedOut.epochTimedOut).toBe(true);
      expect(timedOut.shouldCompute).toBe(false);
      expect(timedOut.accumulator.intervals).toHaveLength(0);
    });
  });

  describe("format helpers", () => {
    it("formatta mm:ss e progress clinico/cliente", () => {
      expect(formatDurationMmSs(0)).toBe("00:00");
      expect(formatDurationMmSs(84_000)).toBe("01:24");
      expect(formatDurationMmSs(CLINICAL_EPOCH_TARGET_MS)).toBe("05:00");
      expect(formatHrvProgressLabel("client", 12, 0)).toBe("12/30");
      expect(formatHrvProgressLabel("clinical", 0, 84_000)).toBe(
        "01:24 / 05:00"
      );
      expect(hrvProgressPercent("client", 0, 0)).toBe(0);
      expect(hrvProgressPercent("client", 15, 0)).toBe(50);
      expect(hrvProgressPercent("client", 30, 0)).toBe(100);
      expect(hrvProgressPercent("clinical", 0, 0)).toBe(0);
      expect(hrvProgressPercent("clinical", 0, 150_000)).toBe(50);
      expect(hrvProgressPercent("clinical", 0, CLINICAL_EPOCH_TARGET_MS)).toBe(
        100
      );
    });

    it("beginNextClinicalEpoch svuota l’accumulatore", () => {
      expect(beginNextClinicalEpoch().intervals).toHaveLength(0);
      expect(beginNextClinicalEpoch().acceptedDurationMs).toBe(0);
    });

    it("avvia wall-clock anche prima dei campioni accettati", () => {
      const started = markHrvAcquisitionStarted(
        createEmptyHrvEpochAccumulator(),
        1000
      );
      expect(started.wallClockStartedAt).toBe(1000);
      expect(hrvWallElapsedMs(started, 4500)).toBe(3500);
      expect(isHrvAcquisitionTimedOut(started, 3000, 4500)).toBe(true);
      expect(isHrvAcquisitionTimedOut(started, 5000, 4500)).toBe(false);
    });
  });
});
