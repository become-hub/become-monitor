import {
  MUSE_PRODUCTS,
  getMuseProductBadge,
  isSupportedMuseDevice,
  resolveMuseProduct,
} from "../muse-products";

describe("muse-products", () => {
  it("riconosce Muse 2 da nome BLE", () => {
    expect(resolveMuseProduct("Muse-2A3B")?.id).toBe("muse_2");
    expect(resolveMuseProduct("Muse S")?.id).toBe("muse_2");
    expect(resolveMuseProduct("Muse 2")?.id).toBe("muse_2");
  });

  it("ignora device non Muse", () => {
    expect(resolveMuseProduct("Polar H10")).toBeNull();
    expect(resolveMuseProduct("")).toBeNull();
    expect(resolveMuseProduct(null)).toBeNull();
  });

  it("isSupportedMuseDevice", () => {
    expect(isSupportedMuseDevice("Muse-2200")).toBe(true);
    expect(isSupportedMuseDevice("Polar 360")).toBe(false);
  });

  it("badge e capabilities", () => {
    expect(getMuseProductBadge("Muse 2")).toBe("Muse 2");
    expect(MUSE_PRODUCTS.muse_2.capabilities.eeg).toBe(true);
    expect(MUSE_PRODUCTS.muse_2.capabilities.ppg).toBe(true);
    expect(MUSE_PRODUCTS.muse_2.capabilities.ftuRequired).toBe(false);
  });
});
