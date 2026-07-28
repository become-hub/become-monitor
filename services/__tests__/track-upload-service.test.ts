/**
 * Tests for track upload mapping / dry-run
 */

import {
  getTrackUploadUrl,
  mapBufferSamplesToTrack,
  mapOfflineSamplesToTrack,
  uploadSessionTrack,
} from "../track-upload-service";

describe("track-upload-service", () => {
  const originalEnv = process.env.EXPO_PUBLIC_TRACK_UPLOAD_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_TRACK_UPLOAD_URL = originalEnv;
  });

  it("mapOfflineSamplesToTrack adds rr from PPI", () => {
    const samples = mapOfflineSamplesToTrack(
      [{ ppiMs: 800, hr: 75, errorEstimate: 1, blockerBit: false }],
      "2026-01-01T00:00:00.000Z"
    );
    expect(samples[0].rrMs).toBe(800);
    expect(samples[0].rrSource).toBe("ppi");
    expect(samples[0].t).toBe("2026-01-01T00:00:00.000Z");
  });

  it("mapBufferSamplesToTrack preserves fields", () => {
    const samples = mapBufferSamplesToTrack([
      {
        t: "2026-01-01T00:00:01.000Z",
        ppiMs: 790,
        hr: 76,
        rrMs: 790,
        rrSource: "ppi",
      },
    ]);
    expect(samples).toHaveLength(1);
    expect(samples[0].rrSource).toBe("ppi");
  });

  it("uploadSessionTrack dry-runs when URL empty", async () => {
    process.env.EXPO_PUBLIC_TRACK_UPLOAD_URL = "";
    const result = await uploadSessionTrack({
      type: "ppiTrack",
      deviceId: "dev",
      endedAt: new Date().toISOString(),
      source: "app_live_buffer",
      samples: [],
    });
    expect(result).toEqual({ ok: true, dryRun: true });
  });

  it("getTrackUploadUrl trims env", () => {
    process.env.EXPO_PUBLIC_TRACK_UPLOAD_URL = " https://example.test/track ";
    expect(getTrackUploadUrl()).toBe("https://example.test/track");
  });
});
