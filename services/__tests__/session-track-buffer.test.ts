/**
 * Tests for session track buffer
 */

import { SessionTrackBuffer } from "../session-track-buffer";

describe("SessionTrackBuffer", () => {
  it("accumula sample PPI con RR source ppi", () => {
    const buf = new SessionTrackBuffer();
    const sample = buf.pushPpi({ ppiMs: 800, hr: 75, errorEstimate: 2 });
    expect(sample?.rrMs).toBe(800);
    expect(sample?.rrSource).toBe("ppi");
    expect(buf.getLength()).toBe(1);
    expect(buf.getStartedAt()).toBeTruthy();
  });

  it("accumula sample HR-derived", () => {
    const buf = new SessionTrackBuffer();
    const sample = buf.pushHr(75);
    expect(sample?.rrMs).toBe(800);
    expect(sample?.rrSource).toBe("hr_derived");
  });

  it("clear resetta lo stato", () => {
    const buf = new SessionTrackBuffer();
    buf.pushHr(70);
    buf.clear();
    expect(buf.getLength()).toBe(0);
    expect(buf.getStartedAt()).toBeNull();
  });
});
