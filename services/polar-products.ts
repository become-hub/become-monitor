/**
 * Catalogo prodotti Polar supportati (BLE name matching + metadata UI).
 */

export type PolarProductId = 'polar_360' | 'polar_loop';

export type PolarProductImageKey = 'polar360' | 'polarLoop';

export interface PolarProduct {
  id: PolarProductId;
  displayName: string;
  /** BLE local name substrings (case-insensitive); first match wins per product. */
  bleNameMatchers: string[];
  imageKey: PolarProductImageKey;
  shortDescriptionIt: string;
  shortDescriptionEn: string;
  capabilities: {
    opticalPpg: boolean;
    ecg: boolean;
    hr: boolean;
    ppi: boolean;
    rawPpg: boolean;
    accelerometer: boolean;
    skinTemperature: boolean;
    ftuRequired: boolean;
  };
}

export const POLAR_PRODUCTS: Record<PolarProductId, PolarProduct> = {
  polar_360: {
    id: 'polar_360',
    displayName: 'Polar 360',
    bleNameMatchers: ['360'],
    imageKey: 'polar360',
    shortDescriptionIt:
      'Collega il Polar 360 per monitorare HR e HRV nelle app Become Hub',
    shortDescriptionEn:
      'Connect Polar 360 to monitor HR and HRV in Become Hub apps',
    capabilities: {
      opticalPpg: true,
      ecg: false,
      hr: true,
      ppi: true,
      rawPpg: true,
      accelerometer: true,
      skinTemperature: true,
      ftuRequired: true,
    },
  },
  polar_loop: {
    id: 'polar_loop',
    displayName: 'Polar Loop',
    bleNameMatchers: ['loop'],
    imageKey: 'polarLoop',
    shortDescriptionIt:
      'Collega il Polar Loop Gen 2 per monitorare HR e HRV nelle app Become Hub',
    shortDescriptionEn:
      'Connect Polar Loop Gen 2 to monitor HR and HRV in Become Hub apps',
    capabilities: {
      opticalPpg: true,
      ecg: false,
      hr: true,
      ppi: true,
      rawPpg: true,
      accelerometer: true,
      skinTemperature: true,
      ftuRequired: true,
    },
  },
};

/** Ordine overview / catalogo (360 prima, poi Loop). */
export const POLAR_PRODUCT_LIST: PolarProduct[] = [
  POLAR_PRODUCTS.polar_360,
  POLAR_PRODUCTS.polar_loop,
];

/**
 * Risolve il prodotto Polar dal nome BLE. H10 / Sense / altri → null.
 */
export function resolvePolarProduct(
  deviceName: string | null | undefined
): PolarProduct | null {
  if (!deviceName) {
    return null;
  }
  const normalized = deviceName.toLowerCase();

  for (const product of POLAR_PRODUCT_LIST) {
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

export function isSupportedPolarDevice(
  deviceName: string | null | undefined
): boolean {
  return resolvePolarProduct(deviceName) !== null;
}

export function getPolarProductBadge(
  deviceName: string | null | undefined
): string {
  return resolvePolarProduct(deviceName)?.displayName ?? 'Polar';
}
