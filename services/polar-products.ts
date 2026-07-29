/**
 * Catalogo prodotti Polar supportati (BLE name matching + metadata UI).
 */

export type PolarProductId = 'polar_360' | 'polar_loop' | 'polar_h10';

export type PolarProductImageKey = 'polar360' | 'polarLoop' | 'polarH10';

export interface PolarProductCapabilities {
  opticalPpg: boolean;
  ecg: boolean;
  hr: boolean;
  ppi: boolean;
  rawPpg: boolean;
  rawEcg: boolean;
  accelerometer: boolean;
  skinTemperature: boolean;
  ftuRequired: boolean;
}

export interface PolarProduct {
  id: PolarProductId;
  displayName: string;
  /** BLE local name substrings (case-insensitive); first match wins per product. */
  bleNameMatchers: string[];
  imageKey: PolarProductImageKey;
  shortDescriptionIt: string;
  shortDescriptionEn: string;
  capabilities: PolarProductCapabilities;
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
      rawEcg: false,
      accelerometer: true,
      skinTemperature: true,
      ftuRequired: true,
    },
  },
  polar_loop: {
    id: 'polar_loop',
    displayName: 'Polar Loop Gen 2',
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
      rawEcg: false,
      accelerometer: true,
      skinTemperature: true,
      ftuRequired: true,
    },
  },
  polar_h10: {
    id: 'polar_h10',
    displayName: 'Polar H10',
    bleNameMatchers: ['h10'],
    imageKey: 'polarH10',
    shortDescriptionIt:
      'Collega il Polar H10 (ECG) per HR e RR nativi nelle app Become Hub',
    shortDescriptionEn:
      'Connect Polar H10 (ECG) for native HR and RR in Become Hub apps',
    capabilities: {
      opticalPpg: false,
      ecg: true,
      hr: true,
      ppi: false,
      rawPpg: false,
      rawEcg: true,
      accelerometer: true,
      skinTemperature: false,
      ftuRequired: false,
    },
  },
};

/** Ordine overview / catalogo (360, Loop, H10). */
export const POLAR_PRODUCT_LIST: PolarProduct[] = [
  POLAR_PRODUCTS.polar_360,
  POLAR_PRODUCTS.polar_loop,
  POLAR_PRODUCTS.polar_h10,
];

/**
 * Risolve il prodotto Polar dal nome BLE. Sense / altri non supportati → null.
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
