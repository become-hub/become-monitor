/**
 * Contract tests for Polar Ably heartRate live payload (360 / Loop).
 */

import { APP_VERSION } from "@/constants/app-version";
import { resolveRrInterval } from "../rr-interval";
import {
  buildPolarAblyHeartRatePayload,
  polarExtrasFromStash,
  resolvePolarContact,
  stashPolarHrExtras,
  stashPolarPpiExtras,
} from "../polar-ably-payload";

const expectedAppVersion = `v${APP_VERSION}`;

const nullExtras = {
  contactStatus: null,
  contactStatusSupported: null,
  errorEstimate: null,
  blocker: null,
  ppgQuality: null,
  correctedHr: null,
  rrAvailable: null,
  rrsMs: null,
  appVersion: expectedAppVersion,
} as const;

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
        ...nullExtras,
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

  describe("segnali extra (contatto, qualità, appVersion)", () => {
    it("propaga campi PPI + HR e appVersion", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "360",
        deviceModel: "polar_360",
        hr: 74,
        rrMs: 812,
        rrSource: "ppi",
        ppiMs: 812,
        contactStatus: true,
        contactStatusSupported: true,
        errorEstimate: 8,
        blocker: false,
        ppgQuality: 90,
        correctedHr: 73,
        rrAvailable: false,
        rrsMs: null,
      });

      expect(payload.contactStatus).toBe(true);
      expect(payload.contactStatusSupported).toBe(true);
      expect(payload.errorEstimate).toBe(8);
      expect(payload.blocker).toBe(false);
      expect(payload.ppgQuality).toBe(90);
      expect(payload.correctedHr).toBe(73);
      expect(payload.rrAvailable).toBe(false);
      expect(payload.rrsMs).toBeNull();
      expect(payload.appVersion).toBe(expectedAppVersion);
    });

    it("azzera ppgQuality/correctedHr a 0 e rrsMs vuoto", () => {
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "360",
        deviceModel: "polar_360",
        hr: 70,
        ppgQuality: 0,
        correctedHr: 0,
        rrsMs: [],
      });

      expect(payload.ppgQuality).toBeNull();
      expect(payload.correctedHr).toBeNull();
      expect(payload.rrsMs).toBeNull();
    });

    it("mantiene errorEstimate=0 (qualità PPI ottima)", () => {
      expect(
        buildPolarAblyHeartRatePayload({
          deviceId: "360",
          deviceModel: "polar_360",
          hr: 70,
          errorEstimate: 0,
        }).errorEstimate
      ).toBe(0);
    });

    it("copia rrsMs senza mutare l'input", () => {
      const rrsMs = [820, 810];
      const payload = buildPolarAblyHeartRatePayload({
        deviceId: "h10",
        deviceModel: "polar_h10",
        hr: 72,
        rrsMs,
      });
      expect(payload.rrsMs).toEqual([820, 810]);
      expect(payload.rrsMs).not.toBe(rrsMs);
    });
  });

  describe("contratto live completo Loop", () => {
    it("produce il shape documentato per Hub (Loop + PPI + skin + extras, senza date)", () => {
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
        contactStatus: true,
        contactStatusSupported: true,
        errorEstimate: 5,
        blocker: false,
        ppgQuality: null,
        correctedHr: null,
        rrAvailable: false,
        rrsMs: null,
      });

      expect(Object.keys(payload).sort()).toEqual(
        [
          "appVersion",
          "blocker",
          "contactStatus",
          "contactStatusSupported",
          "correctedHr",
          "deviceId",
          "deviceModel",
          "errorEstimate",
          "hfPower",
          "hr",
          "hrv",
          "lfPower",
          "ppgQuality",
          "ppiMs",
          "rrAvailable",
          "rrMs",
          "rrSource",
          "rrsMs",
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
        contactStatus: true,
        contactStatusSupported: true,
        errorEstimate: 5,
        blocker: false,
        ppgQuality: null,
        correctedHr: null,
        rrAvailable: false,
        rrsMs: null,
        appVersion: expectedAppVersion,
      });
      expect(payload).not.toHaveProperty("date");
    });
  });
});

describe("resolvePolarContact", () => {
  it("preferisce contatto PPI quando skinContactSupported", () => {
    expect(
      resolvePolarContact(
        { skinContactStatus: false, skinContactSupported: true },
        { contactDetected: true, contactSupported: true }
      )
    ).toEqual({
      contactStatus: false,
      contactStatusSupported: true,
    });
  });

  it("usa contatto HR se PPI non supporta skin contact", () => {
    expect(
      resolvePolarContact(
        { skinContactStatus: null, skinContactSupported: false },
        { contactDetected: true, contactSupported: true }
      )
    ).toEqual({
      contactStatus: true,
      contactStatusSupported: true,
    });
  });
});

describe("stash + polarExtrasFromStash", () => {
  it("stashPolarPpiExtras e stashPolarHrExtras normalizzano i valori", () => {
    expect(
      stashPolarPpiExtras({
        errorEstimate: 12,
        blocker: true,
        skinContactStatus: true,
        skinContactSupported: true,
      })
    ).toEqual({
      errorEstimate: 12,
      blocker: true,
      skinContactStatus: true,
      skinContactSupported: true,
    });

    expect(
      stashPolarHrExtras({
        ppgQuality: 0,
        correctedHr: 71,
        rrAvailable: true,
        rrsMs: [800],
        contactDetected: true,
        contactSupported: true,
      })
    ).toEqual({
      ppgQuality: null,
      correctedHr: 71,
      rrAvailable: true,
      rrsMs: [800],
      contactDetected: true,
      contactSupported: true,
    });
  });

  it("polarExtrasFromStash unisce PPI + HR con priorità contatto PPI", () => {
    const extras = polarExtrasFromStash(
      stashPolarPpiExtras({
        errorEstimate: 4,
        blocker: false,
        skinContactStatus: true,
        skinContactSupported: true,
      }),
      stashPolarHrExtras({
        ppgQuality: 88,
        correctedHr: 0,
        rrAvailable: false,
        rrsMs: [],
        contactDetected: false,
        contactSupported: true,
      })
    );

    expect(extras).toEqual({
      contactStatus: true,
      contactStatusSupported: true,
      errorEstimate: 4,
      blocker: false,
      ppgQuality: 88,
      correctedHr: null,
      rrAvailable: false,
      rrsMs: null,
    });
  });
});
