/**
 * Catalogo prodotti Muse supportati (BLE name matching + metadata UI).
 * Famiglia separata da Polar — non modificare polar-products.
 */

export type MuseProductId = "muse_2";

export type MuseProductImageKey = "muse2";

export interface MuseProductCapabilities {
  eeg: boolean;
  bandPowers: boolean;
  ppg: boolean;
  accelerometer: boolean;
  ftuRequired: boolean;
}

export interface MuseProduct {
  id: MuseProductId;
  displayName: string;
  bleNameMatchers: string[];
  imageKey: MuseProductImageKey;
  shortDescriptionIt: string;
  shortDescriptionEn: string;
  capabilities: MuseProductCapabilities;
}

export const MUSE_PRODUCTS: Record<MuseProductId, MuseProduct> = {
  muse_2: {
    id: "muse_2",
    displayName: "Muse 2",
    bleNameMatchers: ["muse-2", "muse 2", "muse2", "muse"],
    imageKey: "muse2",
    shortDescriptionIt:
      "Collega il Muse 2 per EEG (TP9/AF7/AF8/TP10), bande e HR da PPG nelle app Become Hub",
    shortDescriptionEn:
      "Connect Muse 2 for EEG (TP9/AF7/AF8/TP10), band powers and PPG HR in Become Hub apps",
    capabilities: {
      eeg: true,
      bandPowers: true,
      ppg: true,
      accelerometer: false,
      ftuRequired: false,
    },
  },
};

export const MUSE_PRODUCT_LIST: MuseProduct[] = [MUSE_PRODUCTS.muse_2];

/**
 * Risolve il prodotto Muse dal nome BLE. Matchers più lunghi/specifici prima.
 */
export function resolveMuseProduct(
  deviceName: string | null | undefined
): MuseProduct | null {
  if (!deviceName) {
    return null;
  }
  const normalized = deviceName.toLowerCase();

  const sorted = [...MUSE_PRODUCT_LIST].sort(
    (a, b) =>
      Math.max(...b.bleNameMatchers.map((m) => m.length)) -
      Math.max(...a.bleNameMatchers.map((m) => m.length))
  );

  for (const product of sorted) {
    if (
      product.bleNameMatchers.some((matcher) =>
        normalized.includes(matcher.toLowerCase())
      )
    ) {
      return product;
    }
  }
  return null;
}

export function isSupportedMuseDevice(
  deviceName: string | null | undefined
): boolean {
  return resolveMuseProduct(deviceName) !== null;
}

export function getMuseProductBadge(
  deviceName: string | null | undefined
): string {
  return resolveMuseProduct(deviceName)?.displayName ?? "Muse";
}
