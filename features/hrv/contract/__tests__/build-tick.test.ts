import { createBeatOutbox, nextFrame, pushBeat } from "../../ppi/beat-outbox";
import { buildPolarHeartRateTick, buildPolarH10HeartRateTick } from "../build-tick";
import { buildPolarSessionMetaPayload } from "../build-session-meta";
import { buildPolarSessionEndPayload } from "../build-session-end";
import { HRV_PREPROCESSING_EXPORT } from "../../ppi/ppi-sample-window";
import {
  POLAR_ALGO_VERSION,
  POLAR_PAYLOAD_SCHEMA_VERSION,
} from "../contract-version";

describe("buildPolarHeartRateTick (v2)", () => {
  it("produce un tick snello senza campi null/default", () => {
    let box = createBeatOutbox();
    box = nextFrame(box);
    const pushed = pushBeat(box, {
      ppiMs: 812,
      errorEstimate: 6,
      kind: "accepted",
      blocker: false,
    });
    const tick = buildPolarHeartRateTick({
      sid: "a1b2c3",
      hr: 74,
      hrv: 42,
      lfPower: 1200,
      hfPower: 800,
      lfHfStatus: "provisional",
      beats: pushed.outbox.pending,
      windowFromSeq: 900,
      blocker: false,
      contactStatus: true,
    });
    expect(tick).toEqual({
      sid: "a1b2c3",
      hr: 74,
      hrv: 42,
      lfPower: 1200,
      hfPower: 800,
      lfHfStatus: "provisional",
      windowFromSeq: 900,
      beats: [[1, 812, 6, 0, 0, 1, 1]],
    });
    expect(tick).not.toHaveProperty("blocker");
    expect(tick).not.toHaveProperty("signalStale");
    expect(tick).not.toHaveProperty("ppisMs");
    expect(JSON.stringify(tick).length).toBeLessThan(400);
  });

  it("ramo signalStale: hr 0, niente beats", () => {
    const tick = buildPolarHeartRateTick({
      sid: "x",
      hr: 80,
      signalStale: true,
      beats: [[1, 800, 5, 0, 0, 1, 1]],
      hrv: 40,
    });
    expect(tick).toEqual({
      sid: "x",
      hr: 0,
      signalStale: true,
      beats: [],
    });
  });

  it("include checkpoint solo quando richiesto", () => {
    const tick = buildPolarHeartRateTick({
      sid: "x",
      hr: 70,
      beats: [],
      includeWindowCheckpoint: true,
      windowCrc: "abcd1234",
      windowBeatCount: 10,
      windowFromSeq: 1,
    });
    expect(tick.windowCrc).toBe("abcd1234");
    expect(tick.windowBeatCount).toBe(10);
  });

  it("H10 tick include rrsMs nativi", () => {
    const tick = buildPolarH10HeartRateTick({
      sid: "h10",
      hr: 72,
      hrv: 50,
      rrsMs: [820, 815],
    });
    expect(tick.rrSource).toBe("ecg_rr");
    expect(tick.rrsMs).toEqual([820, 815]);
  });
});

describe("sessionMeta / sessionEnd", () => {
  it("sessionMeta porta schemaVersion e algoVersion", () => {
    const meta = buildPolarSessionMetaPayload({
      sid: "a1",
      ep: 2,
      deviceId: "E5",
      deviceModel: "polar_360",
      rrSource: "ppi",
      contactStatusSupported: true,
      hrvAnalysisMode: "client",
      hrvPreprocessing: HRV_PREPROCESSING_EXPORT,
      appVersion: "v1.2.5",
    });
    expect(meta.schemaVersion).toBe(POLAR_PAYLOAD_SCHEMA_VERSION);
    expect(meta.algoVersion).toBe(POLAR_ALGO_VERSION);
    expect(meta.beatsColumns).toContain("frameId");
    expect(meta.beatsColumns).toContain("blocker");
  });

  it("sessionEnd riepiloga la sessione", () => {
    expect(
      buildPolarSessionEndPayload({
        sid: "a1",
        lastSeq: 100,
        beatCount: 100,
        epochs: 2,
        ticks: 90,
      })
    ).toEqual({
      sid: "a1",
      lastSeq: 100,
      beatCount: 100,
      epochs: 2,
      ticks: 90,
    });
  });
});
