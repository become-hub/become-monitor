import { startMuseStreamingForProduct } from "../muse-device-setup";
import { MUSE_PRODUCTS } from "../muse-products";

jest.mock("@/services/sentry", () => ({
  captureException: jest.fn(),
  logToSentry: jest.fn(),
}));

describe("muse-device-setup", () => {
  const log = { log: jest.fn() };

  beforeEach(() => {
    log.log.mockClear();
    jest.clearAllMocks();
  });

  it("avvia EEG e PPG per Muse 2", async () => {
    const sdk = {
      startEegStreaming: jest.fn().mockResolvedValue(undefined),
      startPpgStreaming: jest.fn().mockResolvedValue(undefined),
    };
    const result = await startMuseStreamingForProduct(
      MUSE_PRODUCTS.muse_2,
      sdk,
      log
    );
    expect(result).toEqual({ eeg: true, ppg: true });
    expect(sdk.startEegStreaming).toHaveBeenCalled();
    expect(sdk.startPpgStreaming).toHaveBeenCalled();
  });

  it("non fallisce se PPG manca e logga su Sentry", async () => {
    const { logToSentry } = require("@/services/sentry");
    const sdk = {
      startEegStreaming: jest.fn().mockResolvedValue(undefined),
      startPpgStreaming: jest.fn().mockRejectedValue(new Error("no ppg")),
    };
    const result = await startMuseStreamingForProduct(
      MUSE_PRODUCTS.muse_2,
      sdk,
      log
    );
    expect(result.eeg).toBe(true);
    expect(result.ppg).toBe(false);
    expect(logToSentry).toHaveBeenCalledWith(
      "Muse PPG streaming unavailable",
      "error",
      expect.objectContaining({ deviceFamily: "muse" })
    );
  });
});
