/**
 * Tests for RR interval helpers
 */

import { resolveRrInterval, rrFromHr, rrFromPpi } from "../rr-interval";

describe("rr-interval", () => {
  it("rrFromHr uses 60000/HR", () => {
    expect(rrFromHr(75)).toBe(800);
    expect(rrFromHr(60)).toBe(1000);
    expect(rrFromHr(0)).toBeNull();
    expect(rrFromHr(-1)).toBeNull();
  });

  it("rrFromPpi rounds PPI ms", () => {
    expect(rrFromPpi(812)).toBe(812);
    expect(rrFromPpi(812.6)).toBe(813);
    expect(rrFromPpi(0)).toBeNull();
  });

  it("preferisce PPI rispetto a HR", () => {
    expect(resolveRrInterval({ ppiMs: 790, hrBpm: 75 })).toEqual({
      rrMs: 790,
      rrSource: "ppi",
    });
  });

  it("deriva da HR se PPI assente", () => {
    expect(resolveRrInterval({ hrBpm: 75 })).toEqual({
      rrMs: 800,
      rrSource: "hr_derived",
    });
  });
});
