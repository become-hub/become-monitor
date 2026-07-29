import {
  ensurePolarReady,
  startPolarStreamingForProduct,
  startPpiStreamingWithFallback,
  type PolarSetupSdk,
} from "../polar-device-setup";
import { POLAR_PRODUCTS } from "../polar-products";

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

    it("returns ready immediately when requireFtu is false", async () => {
      const sdk = createSdk({
        ensureFirstTimeUse: jest.fn(),
      });

      await expect(
        ensurePolarReady("ABC", sdk, { requireFtu: false })
      ).resolves.toEqual({ status: "ready" });
      expect(sdk.ensureFirstTimeUse).not.toHaveBeenCalled();
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

  describe("startPolarStreamingForProduct", () => {
    it("uses PPI path for 360", async () => {
      const sdk = createSdk();
      const log = { log: jest.fn() };

      await expect(
        startPolarStreamingForProduct(
          POLAR_PRODUCTS.polar_360,
          "ABC",
          sdk,
          log
        )
      ).resolves.toEqual({ ppi: true, hr: false, ecg: false });
      expect(sdk.startPpiStreaming).toHaveBeenCalledWith("ABC");
    });

    it("uses HR+ECG path for H10 without PPI", async () => {
      const sdk = createSdk({
        startPpiStreaming: jest.fn(),
        startHrStreaming: jest.fn().mockResolvedValue(undefined),
        startEcgStreaming: jest.fn().mockResolvedValue(undefined),
      });
      const log = { log: jest.fn() };

      await expect(
        startPolarStreamingForProduct(
          POLAR_PRODUCTS.polar_h10,
          "H10-1",
          sdk,
          log
        )
      ).resolves.toEqual({ ppi: false, hr: true, ecg: true });
      expect(sdk.startPpiStreaming).not.toHaveBeenCalled();
      expect(sdk.startHrStreaming).toHaveBeenCalledWith("H10-1");
      expect(sdk.startEcgStreaming).toHaveBeenCalledWith("H10-1");
    });
  });
});
