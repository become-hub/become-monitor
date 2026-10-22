import { isPolarReferenceCandidate } from "../polar-reference-device";

describe("isPolarReferenceCandidate", () => {
  it("matches Polar H10 names regardless of the H10 availability flag", () => {
    expect(isPolarReferenceCandidate("Polar H10 1BDEE93F")).toBe(true);
    expect(isPolarReferenceCandidate("polar h10 abc")).toBe(true);
  });

  it("rejects 360, Loop and empty names", () => {
    expect(isPolarReferenceCandidate("Polar 360 A1B2C3")).toBe(false);
    expect(isPolarReferenceCandidate("Polar Loop 123")).toBe(false);
    expect(isPolarReferenceCandidate("")).toBe(false);
    expect(isPolarReferenceCandidate(null)).toBe(false);
  });
});
