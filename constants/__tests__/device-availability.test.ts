import {
  DEVICE_AVAILABILITY,
  isDeviceAvailable,
  isMuseFamilyAvailable,
} from "../device-availability";

describe("device-availability", () => {
  it("default: 360 e Loop on, H10 e Muse 2 off", () => {
    expect(DEVICE_AVAILABILITY.polar_360).toBe(true);
    expect(DEVICE_AVAILABILITY.polar_loop).toBe(true);
    expect(DEVICE_AVAILABILITY.polar_h10).toBe(false);
    expect(DEVICE_AVAILABILITY.muse_2).toBe(false);
  });

  it("isDeviceAvailable riflette i flag", () => {
    expect(isDeviceAvailable("polar_360")).toBe(true);
    expect(isDeviceAvailable("polar_loop")).toBe(true);
    expect(isDeviceAvailable("polar_h10")).toBe(false);
    expect(isDeviceAvailable("muse_2")).toBe(false);
  });

  it("isMuseFamilyAvailable è false quando muse_2 è off", () => {
    expect(isMuseFamilyAvailable()).toBe(false);
  });
});
