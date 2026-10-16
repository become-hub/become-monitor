import {
  buildPolarSignalQualityUi,
  HR_ZERO_GRACE_MS,
  isFresh,
  isPolarMotionPoor,
  isPolarSkinContactPoor,
  isPolarWearQualityPoor,
  isSustainedHrZero,
  isUsablePpiMs,
  PPI_ERROR_ESTIMATE_POOR_MS,
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

  describe("isPolarSkinContactPoor / isPolarMotionPoor", () => {
    const base = {
      contactStatus: true as boolean | null,
      contactStatusSupported: true as boolean | null,
      errorEstimate: 5 as number | null,
      blocker: false as boolean | null,
      ppgQuality: null as number | null,
    };

    it("distingue contatto pelle da movimento", () => {
      expect(
        isPolarSkinContactPoor({
          ...base,
          contactStatus: false,
        })
      ).toBe(true);
      expect(
        isPolarMotionPoor({
          ...base,
          contactStatus: false,
        })
      ).toBe(false);

      expect(
        isPolarSkinContactPoor({
          ...base,
          blocker: true,
        })
      ).toBe(false);
      expect(
        isPolarMotionPoor({
          ...base,
          blocker: true,
        })
      ).toBe(true);
    });
  });

  describe("isPolarWearQualityPoor", () => {
    it("segna scarso senza contatto pelle supportato", () => {
      expect(
        isPolarWearQualityPoor({
          contactStatus: false,
          contactStatusSupported: true,
          errorEstimate: 5,
          blocker: false,
          ppgQuality: null,
        })
      ).toBe(true);
    });

    it("segna scarso con blocker o errorEstimate alto", () => {
      expect(
        isPolarWearQualityPoor({
          contactStatus: true,
          contactStatusSupported: true,
          errorEstimate: 5,
          blocker: true,
          ppgQuality: null,
        })
      ).toBe(true);
      expect(
        isPolarWearQualityPoor({
          contactStatus: true,
          contactStatusSupported: true,
          errorEstimate: PPI_ERROR_ESTIMATE_POOR_MS + 1,
          blocker: false,
          ppgQuality: null,
        })
      ).toBe(true);
    });

    it("è ok con contatto e qualità PPI buona", () => {
      expect(
        isPolarWearQualityPoor({
          contactStatus: true,
          contactStatusSupported: true,
          errorEstimate: 8,
          blocker: false,
          ppgQuality: null,
        })
      ).toBe(false);
    });
  });

  describe("buildPolarSignalQualityUi", () => {
    it("preferisce contatto PPI e espone errorEstimate/blocker", () => {
      expect(
        buildPolarSignalQualityUi(
          {
            errorEstimate: 12,
            blocker: false,
            skinContactStatus: true,
            skinContactSupported: true,
          },
          {
            ppgQuality: 90,
            correctedHr: null,
            rrAvailable: false,
            rrsMs: null,
            contactDetected: false,
            contactSupported: true,
          }
        )
      ).toEqual({
        contactStatus: true,
        contactStatusSupported: true,
        errorEstimate: 12,
        blocker: false,
        ppgQuality: 90,
      });
    });
  });
});
