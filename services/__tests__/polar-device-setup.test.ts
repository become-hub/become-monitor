import {
  ensurePolarReady,
  startPpiStreamingWithFallback,
  type PolarSetupSdk,
} from "../polar-device-setup";

describe("polar-device-setup", () => {
  const createSdk = (overrides: Partial<PolarSetupSdk> = {}): PolarSetupSdk => ({
    ensureFirstTimeUse: jest.fn().mockResolvedValue({ performed: false }),
    startPpiStreaming: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  describe("ensurePolarReady", () => {
    it("returns ready when FTU already done", async () => {
      const sdk = createSdk({
        ensureFirstTimeUse: jest.fn().mockResolvedValue({ performed: false }),
      });

      await expect(ensurePolarReady("ABC", sdk)).resolves.toEqual({
        status: "ready",
      });
    });

    it("returns deferred when FTU just performed", async () => {
      const sdk = createSdk({
        ensureFirstTimeUse: jest.fn().mockResolvedValue({ performed: true }),
      });

      await expect(ensurePolarReady("ABC", sdk)).resolves.toEqual({
        status: "deferred",
      });
    });

    it("returns failed when ensureFirstTimeUse throws", async () => {
      const sdk = createSdk({
        ensureFirstTimeUse: jest
          .fn()
          .mockRejectedValue(new Error("FTU_TIMEOUT")),
      });

      await expect(ensurePolarReady("ABC", sdk)).resolves.toEqual({
        status: "failed",
        error: "FTU_TIMEOUT",
      });
    });
  });

  describe("startPpiStreamingWithFallback", () => {
    it("returns true when PPI starts", async () => {
      const sdk = createSdk();
      const log = { log: jest.fn() };

      await expect(
        startPpiStreamingWithFallback("ABC", sdk, log)
      ).resolves.toBe(true);
      expect(sdk.startPpiStreaming).toHaveBeenCalledWith("ABC");
      expect(log.log).toHaveBeenCalledWith(
        "✅ PPI streaming avviato con successo!"
      );
    });

    it("returns false and logs fallback when PPI fails", async () => {
      const sdk = createSdk({
        startPpiStreaming: jest
          .fn()
          .mockRejectedValue(new Error("PPI not available")),
      });
      const log = { log: jest.fn() };

      await expect(
        startPpiStreamingWithFallback("ABC", sdk, log)
      ).resolves.toBe(false);
      expect(log.log).toHaveBeenCalledWith(
        "⚠️ PPI non disponibile:",
        "PPI not available"
      );
      expect(log.log).toHaveBeenCalledWith(
        "🔄 Usando modalità fallback: HRV calcolato da HR"
      );
    });
  });
});
