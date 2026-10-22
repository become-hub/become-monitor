import { ingestSessionEvents } from "../ingest";
import { assessIntegrity, findSeqGaps } from "../integrity";

describe("ingest + integrity", () => {
  it("ordina, deduplica su seq e raggruppa", () => {
    const session = ingestSessionEvents([
      {
        type: "heartRate",
        sid: "s1",
        timestamp: "2026-01-01T00:00:02Z",
        beats: [[2, 810, 5, 0, 0, 1, 1]],
      },
      {
        type: "heartRate",
        sid: "s1",
        timestamp: "2026-01-01T00:00:01Z",
        beats: [
          [1, 800, 4, 0, 0, 1, 1],
          [2, 810, 5, 0, 0, 1, 1],
        ],
      },
      {
        type: "sessionMeta",
        sid: "s1",
        ep: 1,
        timestamp: "2026-01-01T00:00:00Z",
      },
      {
        type: "sessionEnd",
        sid: "s1",
        lastSeq: 2,
        beatCount: 2,
        epochs: 1,
        ticks: 2,
        timestamp: "2026-01-01T00:01:00Z",
      },
    ]);
    expect(session.sid).toBe("s1");
    expect(session.beats.map((b) => b.seq)).toEqual([1, 2]);
    expect(session.metas).toHaveLength(1);
    expect(session.sessionEnd?.beatCount).toBe(2);
  });

  it("trova buchi di seq e confronta sessionEnd", () => {
    const session = ingestSessionEvents([
      {
        type: "heartRate",
        sid: "s1",
        timestamp: "t1",
        beats: [
          [1, 800, 4, 0, 0, 1, 1],
          [4, 820, 4, 0, 0, 1, 2],
        ],
      },
      {
        type: "sessionEnd",
        sid: "s1",
        lastSeq: 4,
        beatCount: 4,
        epochs: 1,
        ticks: 1,
        timestamp: "t2",
      },
    ]);
    expect(findSeqGaps(session.beats)).toEqual([{ from: 2, to: 3 }]);
    const report = assessIntegrity(session);
    expect(report.gaps).toEqual([{ from: 2, to: 3 }]);
    expect(report.sessionEndOk).toBe(false);
  });
});
