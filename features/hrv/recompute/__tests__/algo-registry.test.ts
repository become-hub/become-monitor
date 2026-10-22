import {
  currentAlgoVersion,
  getAlgoParams,
  listAlgoVersions,
} from "../algo-registry";
import { PPI_ERROR_ESTIMATE_SANE_MS } from "../../ppi/ppi-limits";
import { LF_HF_PPI_ERROR_ESTIMATE_MAX_MS } from "../../ppi/ppi-sample-window";
import {
  DEFAULT_HRV_SAMPLING_HZ,
  MAX_SUCCESSIVE_DIFF_MS,
} from "../../core/hrv-calculator";

describe("algo-registry", () => {
  it("hrv-1 coincide con le costanti correnti", () => {
    const p = getAlgoParams("hrv-1");
    expect(p.rmssdErrorEstimateMaxMs).toBe(PPI_ERROR_ESTIMATE_SANE_MS);
    expect(p.lfHfErrorEstimateMaxMs).toBe(LF_HF_PPI_ERROR_ESTIMATE_MAX_MS);
    expect(p.samplingHz).toBe(DEFAULT_HRV_SAMPLING_HZ);
    expect(p.successiveDiffMaxMs).toBe(MAX_SUCCESSIVE_DIFF_MS);
    expect(currentAlgoVersion()).toBe("hrv-1");
    expect(listAlgoVersions()).toContain("hrv-1");
  });

  it("rifiuta versioni sconosciute", () => {
    expect(() => getAlgoParams("hrv-99")).toThrow(/Unknown algoVersion/);
  });
});
