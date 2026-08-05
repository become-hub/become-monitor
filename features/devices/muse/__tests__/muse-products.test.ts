import {
  MUSE_PRODUCT_LIST,
  MUSE_PRODUCTS,
  getMuseProductBadge,
  isSupportedMuseDevice,
  resolveMuseProduct,
} from "../muse-products";

describe("muse-products", () => {
  it("non risolve Muse 2 quando availability è off", () => {
    expect(resolveMuseProduct("Muse-2A3B")).toBeNull();
    expect(resolveMuseProduct("Muse S")).toBeNull();
    expect(resolveMuseProduct("Muse 2")).toBeNull();
  });

  it("ignora device non Muse", () => {
    expect(resolveMuseProduct("Polar H10")).toBeNull();
    expect(resolveMuseProduct("")).toBeNull();
    expect(resolveMuseProduct(null)).toBeNull();
  });

  it("isSupportedMuseDevice è false con Muse gated", () => {
    expect(isSupportedMuseDevice("Muse-2200")).toBe(false);
    expect(isSupportedMuseDevice("Polar 360")).toBe(false);
  });

  it("MUSE_PRODUCT_LIST è vuota quando Muse è off", () => {
    expect(MUSE_PRODUCT_LIST).toEqual([]);
  });

  it("catalogo completo e badge fallback restano definiti", () => {
    expect(getMuseProductBadge("Muse 2")).toBe("Muse");
    expect(MUSE_PRODUCTS.muse_2.capabilities.eeg).toBe(true);
    expect(MUSE_PRODUCTS.muse_2.capabilities.ppg).toBe(true);
    expect(MUSE_PRODUCTS.muse_2.capabilities.ftuRequired).toBe(false);
  });
});
