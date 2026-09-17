import {
  HR_ZERO_GRACE_MS,
  isFresh,
  isSustainedHrZero,
  isUsablePpiMs,
  PPI_STALE_MS,
  PPI_STREAM_ALIVE_MS,
} from "../polar-live-signal";

describe("polar-live-signal", () => {
  const now = 20_000;

  describe("isUsablePpiMs", () => {
    it("accetta PPI in range anche se Polar li marrebbe blocker", () => {
      expect(isUsablePpiMs(300)).toBe(true);
      expect(isUsablePpiMs(949)).toBe(true);
      expect(isUsablePpiMs(2000)).toBe(true);
    });

    it("scarta fuori range", () => {
      expect(isUsablePpiMs(299)).toBe(false);
      expect(isUsablePpiMs(2001)).toBe(false);
      expect(isUsablePpiMs(0)).toBe(false);
    });
  });

  describe("isFresh", () => {
    it("è fresco dentro la finestra", () => {
      expect(isFresh(now - 2000, now, PPI_STALE_MS)).toBe(true);
      expect(isFresh(now - 1000, now, PPI_STREAM_ALIVE_MS)).toBe(true);
    });

    it("non è fresco se manca il timestamp o è stale", () => {
      expect(isFresh(0, now, PPI_STALE_MS)).toBe(false);
      expect(isFresh(now - 5000, now, PPI_STALE_MS)).toBe(false);
    });
  });

  describe("isSustainedHrZero", () => {
    it("non è dropout se lo zero non è iniziato o è dentro la grace", () => {
      expect(isSustainedHrZero(0, now)).toBe(false);
      expect(isSustainedHrZero(now - 3000, now)).toBe(false);
    });

    it("è dropout dopo la grace", () => {
      expect(isSustainedHrZero(now - HR_ZERO_GRACE_MS, now)).toBe(true);
    });
  });
});
