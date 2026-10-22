import {
  appendPpiSample,
  createEmptyPpiSampleWindow,
  toLfHfIntervalInputs,
} from "../../ppi/ppi-sample-window";
import { computeLfHfFromIntervals } from "../../core/hrv-calculator";
import { windowCrc } from "../../ppi/window-checkpoint";
import { ingestSessionEvents } from "../ingest";
import { replaySession } from "../replay";
import { correctSession } from "../correct";

function syntheticBeats(count: number, ep = 1) {
  const beats: [number, number, number | null, 0 | 1 | 2, 0 | 1, number, number][] = [];
  for (let i = 0; i < count; i += 1) {
    beats.push([
      i + 1,
      800 + (i % 5),
      i % 7 === 0 ? 25 : 5,
      i % 7 === 0 ? 1 : 0,
      i % 11 === 0 ? 1 : 0,
      ep,
      Math.floor(i / 2) + 1,
    ]);
  }
  return beats;
}

describe("replay + correct", () => {
  it("faithful: serie corretta e LF/HF allineati a computeLfHfFromIntervals", () => {
    const tuples = syntheticBeats(40);
    const session = ingestSessionEvents([
      {
        type: "sessionMeta",
        sid: "syn",
        ep: 1,
        hrvAnalysisMode: "client",
        timestamp: "t0",
      },
      {
        type: "heartRate",
        sid: "syn",
        timestamp: "t1",
        beats: tuples,
      },
    ]);

    // Build window the same way as live (with stored kinds via faithful replay).
    let w = createEmptyPpiSampleWindow();
    let t = 1_000_000;
    for (const b of session.beats) {
      w = appendPpiSample(w, {
        ppiMs: b.ppiMs,
        errorEstimate: b.errorEstimate,
        blocker: b.blocker === 1,
        frameNowMs: t,
        mode: "client",
        seq: b.seq,
      });
      t += b.ppiMs;
    }
    // Override kinds to stored
    w.samples.forEach((s, i) => {
      const kind = session.beats[i].kind;
      s.kind =
        kind === 0
          ? "accepted"
          : kind === 1
            ? "quality_rejected"
            : "out_of_physiological_range";
      s.accepted = kind === 0;
      s.includedInTimeline = kind === 0 || kind === 1;
      s.includedInTachogram = s.includedInTimeline;
    });
    const expected = computeLfHfFromIntervals(toLfHfIntervalInputs(w));
    const crc = windowCrc(w);

    const replay = replaySession(session, { policy: { type: "faithful" } });
    const last = replay.frames[replay.frames.length - 1];
    expect(last.correctedPpiSeries).toEqual(expected.correctedPpiSeries);
    expect(last.lf).toBeCloseTo(expected.lf, 9);
    expect(last.hf).toBeCloseTo(expected.hf, 9);
    expect(crc).toMatch(/^[0-9a-f]{8}$/);
  });

  it("reclassify con soglia piu' stretta scarta piu' beat", () => {
    const tuples = syntheticBeats(20);
    const session = ingestSessionEvents([
      {
        type: "heartRate",
        sid: "syn",
        timestamp: "t1",
        beats: tuples,
      },
    ]);
    const faithful = replaySession(session, { policy: { type: "faithful" } });
    const tight = replaySession(session, {
      policy: { type: "reclassify", errorEstimateMaxMs: 10 },
    });
    const fLast = faithful.frames[faithful.frames.length - 1];
    const tLast = tight.frames[tight.frames.length - 1];
    // Tighter gate → more quality_rejected → typically shorter / different Y.
    expect(tLast.correctedPpiSeries.length).toBeLessThanOrEqual(
      fLast.correctedPpiSeries.length
    );
  });

  it("correct: exclude_blocker non muta il grezzo e etichetta il derivato", () => {
    const tuples = syntheticBeats(12);
    const session = ingestSessionEvents([
      {
        type: "heartRate",
        sid: "syn",
        timestamp: "t1",
        beats: tuples,
      },
    ]);
    const rawKinds = session.beats.map((b) => b.kind);
    const corrected = correctSession(session, [{ type: "exclude_blocker" }]);
    expect(session.beats.map((b) => b.kind)).toEqual(rawKinds);
    expect(corrected.inputHash).toMatch(/^[0-9a-f]+$/);
    expect(corrected.recomputeVersion).toMatch(/^corr-/);
    expect(corrected.beats.some((b) => b.blocker === 1 && b.kind === 1)).toBe(
      true
    );
  });

  it("attraverso un reset di epoch i frame restano separati", () => {
    const ep1 = syntheticBeats(6, 1);
    const ep2 = syntheticBeats(6, 2).map((t) => {
      const copy = [...t] as typeof t;
      copy[0] = t[0] + 6;
      return copy;
    });
    const session = ingestSessionEvents([
      { type: "heartRate", sid: "e", timestamp: "t1", beats: ep1 },
      { type: "heartRate", sid: "e", timestamp: "t2", beats: ep2 },
    ]);
    const replay = replaySession(session);
    const eps = new Set(replay.frames.map((f) => f.ep));
    expect(eps.has(1)).toBe(true);
    expect(eps.has(2)).toBe(true);
  });

  it("faithful: il kind salvato guida anche l'orologio di ritenzione", () => {
    // 40 beat da 800 ms; i primi 10 salvati come out_of_range (esclusi dalla
    // timeline) anche se 800 ms sarebbe classificato accettato: il replay deve
    // escluderli come ha fatto il live, senza avanzare il tempo.
    const tuples = syntheticBeats(40).map((t, i) =>
      i < 10 ? ([t[0], t[1], t[2], 2, t[4], t[5], t[6]] as typeof t) : t
    );
    const session = ingestSessionEvents([
      {
        type: "sessionMeta",
        sid: "syn",
        ep: 1,
        hrvAnalysisMode: "client",
        timestamp: "t0",
      },
      { type: "heartRate", sid: "syn", timestamp: "t1", beats: tuples },
    ]);
    const replay = replaySession(session, { policy: { type: "faithful" } });
    const last = replay.frames[replay.frames.length - 1];
    // 30 beat inclusi: la serie corretta non deve contenere i 10 esclusi.
    expect(last.correctedPpiSeries.length).toBeGreaterThan(0);
    const reference = replaySession(
      ingestSessionEvents([
        { type: "heartRate", sid: "syn", timestamp: "t1", beats: tuples.slice(10) },
      ]),
      { policy: { type: "faithful" } }
    );
    const refLast = reference.frames[reference.frames.length - 1];
    expect(last.lf).toBeCloseTo(refLast.lf, 9);
    expect(last.hf).toBeCloseTo(refLast.hf, 9);
  });
});
