import {
  appendPpiSample,
  createEmptyPpiSampleWindow,
} from "../ppi-sample-window";
import {
  buildWindowCheckpoint,
  crc32Hex,
  windowCrc,
  windowFromSeq,
} from "../window-checkpoint";

describe("window-checkpoint", () => {
  it("windowFromSeq restituisce il primo seq o null", () => {
    expect(windowFromSeq([])).toBeNull();
    expect(windowFromSeq([10, 11, 12])).toBe(10);
  });

  it("crc32Hex e' deterministico e sensibile", () => {
    expect(crc32Hex("a")).toBe(crc32Hex("a"));
    expect(crc32Hex("a")).not.toBe(crc32Hex("b"));
    expect(crc32Hex("")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("windowCrc cambia se manca o cambia un beat", () => {
    let w = createEmptyPpiSampleWindow();
    w = appendPpiSample(w, {
      ppiMs: 800,
      errorEstimate: 5,
      blocker: false,
      frameNowMs: 1_000_000,
      mode: "client",
    });
    w = appendPpiSample(w, {
      ppiMs: 810,
      errorEstimate: 4,
      blocker: false,
      frameNowMs: 1_000_800,
      mode: "client",
    });
    const crcA = windowCrc(w);
    let w2 = createEmptyPpiSampleWindow();
    w2 = appendPpiSample(w2, {
      ppiMs: 800,
      errorEstimate: 5,
      blocker: false,
      frameNowMs: 1_000_000,
      mode: "client",
    });
    expect(windowCrc(w2)).not.toBe(crcA);

    const cp = buildWindowCheckpoint(w, [100, 101]);
    expect(cp.windowFromSeq).toBe(100);
    expect(cp.windowBeatCount).toBe(2);
    expect(cp.windowCrc).toBe(crcA);
  });
});
