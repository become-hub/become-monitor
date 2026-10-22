import {
  createReferenceRecorder,
  REFERENCE_RECORDER_CSV_HEADER,
} from "../reference-recorder";

describe("reference-recorder", () => {
  it("records nothing until activated", () => {
    const rec = createReferenceRecorder();
    rec.recordPrimaryBeat({ tMs: 1, seq: 0, ppiMs: 900, kind: "accepted" });
    rec.recordReferencePacket({ tMs: 1, hr: 60, rrsMs: [1000] });
    expect(rec.getSummary()).toMatchObject({
      active: false,
      primaryBeats: 0,
      referenceBeats: 0,
      firstMs: null,
      lastMs: null,
    });
  });

  it("records primary beats and one row per reference RR on the same clock", () => {
    const rec = createReferenceRecorder();
    rec.setActive(true);
    rec.recordPrimaryBeat({ tMs: 1000, seq: 5, ppiMs: 910, kind: "accepted" });
    rec.recordReferencePacket({ tMs: 1200, hr: 64, rrsMs: [940, 950] });
    expect(rec.getSummary()).toEqual({
      active: true,
      primaryBeats: 1,
      referenceBeats: 2,
      firstMs: 1000,
      lastMs: 1200,
      dropped: 0,
    });
  });

  it("ignores packets without usable RR", () => {
    const rec = createReferenceRecorder();
    rec.setActive(true);
    rec.recordReferencePacket({ tMs: 1, hr: 60 });
    rec.recordReferencePacket({ tMs: 2, hr: 60, rrsMs: [] });
    rec.recordReferencePacket({ tMs: 3, hr: 60, rrsMs: [0, -5, Number.NaN] });
    expect(rec.getRows()).toHaveLength(0);
  });

  it("exports CSV with header and both sources", () => {
    const rec = createReferenceRecorder();
    rec.setActive(true);
    rec.recordPrimaryBeat({ tMs: 0, seq: 7, ppiMs: 880, kind: "quality_rejected" });
    rec.recordReferencePacket({ tMs: 1000, hr: 66, rrsMs: [900] });
    const lines = rec.toCsv().split("\n");
    expect(lines[0]).toBe(REFERENCE_RECORDER_CSV_HEADER);
    expect(lines[1]).toBe(
      "primary,0,1970-01-01T00:00:00.000Z,7,880,,quality_rejected"
    );
    expect(lines[2]).toBe(
      "reference,1000,1970-01-01T00:00:01.000Z,,900,66,ecg_rr"
    );
  });

  it("stops at the row cap and counts dropped rows", () => {
    const rec = createReferenceRecorder(2);
    rec.setActive(true);
    rec.recordReferencePacket({ tMs: 1, hr: 60, rrsMs: [1000, 1001, 1002] });
    expect(rec.getRows()).toHaveLength(2);
    expect(rec.getSummary().dropped).toBe(1);
  });

  it("clear empties rows and dropped but keeps active state", () => {
    const rec = createReferenceRecorder(1);
    rec.setActive(true);
    rec.recordReferencePacket({ tMs: 1, hr: 60, rrsMs: [1000, 1001] });
    rec.clear();
    expect(rec.getRows()).toHaveLength(0);
    expect(rec.getSummary()).toMatchObject({ active: true, dropped: 0 });
  });
});
