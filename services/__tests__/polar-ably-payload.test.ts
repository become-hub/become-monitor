/**
 * Contract tests for Polar Ably heartRate live payload (360 / Loop).
 */

import { resolveRrInterval } from "../rr-interval";
import { buildPolarAblyHeartRatePayload } from "../polar-ably-payload";

describe("buildPolarAblyHeartRatePayload", () => {
  describe("PPI path (Polar 360 / Loop)", () => {
    it("include rrMs, rrSource=ppi, ppiMs e deviceModel (PolarProductId)", () => {
      const resolved = resolveRrInterval({ ppiMs: 812, hrBpm: 74 });
      expect(resolved).not.toBeNull();

      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "AA:BB",
        deviceModel: "polar_360",
        hr: 74,
        hrv: 42,
        lfPower: 1200,
        hfPower: 800,
        rrMs: resolved!.rrMs,
        rrSource: resolved!.rrSource,
        ppiMs: 812,
        skinTemperatureC: null,
      });

      expect(payload).toEqual({
        deviceId: "AA:BB",
        deviceModel: "polar_360",
        hr: 74,
        hrv: 42,
        lfPower: 1200,
        hfPower: 800,
        rrMs: 812,
        rrSource: "ppi",
        ppiMs: 812,
        skinTemperatureC: null,
      });
      expect(payload).not.toHaveProperty("heartRate");
      expect(payload).not.toHaveProperty("date");
    });

    it("usa rrMs come fallback ppiMs se ppiMs non passato e source=ppi", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "dev",
        deviceModel: "polar_360",
        hr: 70,
        rrMs: 857,
        rrSource: "ppi",
      });

      expect(payload.ppiMs).toBe(857);
      expect(payload.rrMs).toBe(857);
      expect(payload.rrSource).toBe("ppi");
    });
  });

  describe("deviceModel", () => {
    it("propaga PolarProductId o null", () => {
      expect(
        buildPolarAblyHeartRatePayload({
          deviceId: "a",
          deviceModel: "polar_360",
          hr: 70,
        }).deviceModel
      ).toBe("polar_360");

      expect(
        buildPolarAblyHeartRatePayload({
          deviceId: "b",
          deviceModel: "polar_loop",
          hr: 70,
        }).deviceModel
      ).toBe("polar_loop");

      expect(
        buildPolarAblyHeartRatePayload({
          deviceId: "c",
          deviceModel: "polar_h10",
          hr: 70,
        }).deviceModel
      ).toBe("polar_h10");

      expect(
        buildPolarAblyHeartRatePayload({
          deviceId: "d",
          deviceModel: null,
          hr: 70,
        }).deviceModel
      ).toBeNull();
    });
  });

  describe("skin temperature (Loop Gen 2)", () => {
    it("include skinTemperatureC quando > 0", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "loop",
        deviceModel: "polar_loop",
        hr: 72,
        rrMs: 800,
        rrSource: "ppi",
        ppiMs: 800,
        skinTemperatureC: 33.4,
      });

      expect(payload.skinTemperatureC).toBe(33.4);
    });

    it("azzera skinTemperatureC per 360 / assente (0, null, undefined, NaN)", () => {
      for (const skinTemperatureC of [0, null, undefined, NaN, -1] as const) {
        const payload = buildPolarAblyHeartRatePayload({
          deviceId: "360",
          deviceModel: "polar_360",
          hr: 72,
          rrMs: 800,
          rrSource: "ppi",
          ppiMs: 800,
          skinTemperatureC,
        });
        expect(payload.skinTemperatureC).toBeNull();
      }
    });
  });

  describe("RR source rules", () => {
    it("non espone ppiMs quando rrSource è hr_derived", () => {
      const resolved = resolveRrInterval({ hrBpm: 75 });
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "dev",
        deviceModel: "polar_360",
        hr: 75,
        rrMs: resolved!.rrMs,
        rrSource: resolved!.rrSource,
        ppiMs: 999,
      });

      expect(payload.rrSource).toBe("hr_derived");
      expect(payload.rrMs).toBe(800);
      expect(payload.ppiMs).toBeNull();
    });

    it("non espone ppiMs quando rrSource è ecg_rr anche se ppiMs è passato", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "h10",
        deviceModel: "polar_h10",
        hr: 80,
        rrMs: 750,
        rrSource: "ecg_rr",
        ppiMs: 750,
      });

      expect(payload.rrSource).toBe("ecg_rr");
      expect(payload.rrMs).toBe(750);
      expect(payload.ppiMs).toBeNull();
    });

    it("rrMs/rrSource null se intervallo assente", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "dev",
        deviceModel: "polar_360",
        hr: 70,
        rrMs: null,
        rrSource: null,
      });

      expect(payload.rrMs).toBeNull();
      expect(payload.rrSource).toBeNull();
      expect(payload.ppiMs).toBeNull();
    });

    it("rrMs 0 o negativo diventa null", () => {
      expect(
        buildPolarAblyHeartRatePayload({
          deviceId: "dev",
          deviceModel: "polar_360",
          hr: 70,
          rrMs: 0,
          rrSource: "ppi",
        }).rrMs
      ).toBeNull();

      expect(
        buildPolarAblyHeartRatePayload({
          deviceId: "dev",
          deviceModel: "polar_360",
          hr: 70,
          rrMs: -5,
          rrSource: "ppi",
        }).rrMs
      ).toBeNull();
    });
  });

  describe("HRV / LF / HF window", () => {
    it("mantiene null finché non ci sono valori positivi (prima dei 30 campioni)", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "dev",
        deviceModel: "polar_360",
        hr: 74,
        hrv: null,
        lfPower: null,
        hfPower: null,
        rrMs: 812,
        rrSource: "ppi",
        ppiMs: 812,
      });

      expect(payload.hrv).toBeNull();
      expect(payload.lfPower).toBeNull();
      expect(payload.hfPower).toBeNull();
    });

    it("azzera 0 come non ancora calcolati", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "dev",
        deviceModel: "polar_360",
        hr: 74,
        hrv: 0,
        lfPower: 0,
        hfPower: 0,
      });

      expect(payload.hrv).toBeNull();
      expect(payload.lfPower).toBeNull();
      expect(payload.hfPower).toBeNull();
    });

    it("propaga HRV/LF/HF dopo la finestra piena", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "dev",
        deviceModel: "polar_360",
        hr: 74,
        hrv: 45,
        lfPower: 1500,
        hfPower: 900,
      });

      expect(payload.hrv).toBe(45);
      expect(payload.lfPower).toBe(1500);
      expect(payload.hfPower).toBe(900);
    });
  });

  describe("campo HR", () => {
    it("espone sempre `hr` (mai `heartRate`)", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "dev",
        deviceModel: "polar_360",
        hr: 68,
      });
      expect(payload.hr).toBe(68);
      expect(payload).not.toHaveProperty("heartRate");
    });
  });

  describe("contratto live completo Loop", () => {
    it("produce il shape documentato per Hub (Loop + PPI + skin, senza date)", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "loop-1",
        deviceModel: "polar_loop",
        hr: 74,
        hrv: 42,
        lfPower: 1200,
        hfPower: 800,
        rrMs: 812,
        rrSource: "ppi",
        ppiMs: 812,
        skinTemperatureC: 33.4,
      });

      expect(Object.keys(payload).sort()).toEqual(
        [
          "deviceId",
          "deviceModel",
          "hfPower",
          "hr",
          "hrv",
          "lfPower",
          "ppiMs",
          "rrMs",
          "rrSource",
          "skinTemperatureC",
        ].sort()
      );

      expect(payload).toMatchObject({
        deviceId: "loop-1",
        deviceModel: "polar_loop",
        hr: 74,
        hrv: 42,
        lfPower: 1200,
        hfPower: 800,
        rrMs: 812,
        rrSource: "ppi",
        ppiMs: 812,
        skinTemperatureC: 33.4,
      });
      expect(payload).not.toHaveProperty("date");
    });
  });
});
