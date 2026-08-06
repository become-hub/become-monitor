/**
 * Catalogo prodotti Polar supportati (BLE name matching + metadata UI).
 */

import { isDeviceAvailable } from '@/constants/device-availability';

export type PolarProductId = 'polar_360' | 'polar_loop' | 'polar_h10';

export interface PolarProductCapabilities {
  opticalPpg: boolean;
  ecg: boolean;
  hr: boolean;
  ppi: boolean;
  rawPpg: boolean;
  rawEcg: boolean;
  accelerometer: boolean;
  /** Start SDK skin-temperature stream when true (Loop Gen 2 only in this app). */
  skinTemperature: boolean;
  /** Show skin-temperature card in Monitor when true (Loop Gen 2 only; not in scope for Polar 360). */
  skinTemperatureUi: boolean;
  ftuRequired: boolean;
}

export interface PolarProduct {
  id: PolarProductId;
  displayName: string;
  /** BLE local name substrings (case-insensitive); first match wins per product. */
  bleNameMatchers: readonly string[];
  shortDescriptionIt: string;
  shortDescriptionEn: string;
  capabilities: PolarProductCapabilities;
}

/** Each map key must equal that entry's `id` (no free-string drift). */
type PolarProductEntry<Id extends PolarProductId> = Omit<PolarProduct, 'id'> & {
  id: Id;
};

export const POLAR_PRODUCTS = {
  polar_360: {
    id: 'polar_360',
    displayName: 'Polar 360',
    bleNameMatchers: ['360'],
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
      skinTemperature: false,
      skinTemperatureUi: false,
      ftuRequired: true,
    },
  },
  polar_loop: {
    id: 'polar_loop',
    displayName: 'Polar Loop Gen 2',
    bleNameMatchers: ['loop'],
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
      skinTemperatureUi: true,
      ftuRequired: true,
    },
  },
  polar_h10: {
    id: 'polar_h10',
    displayName: 'Polar H10',
    bleNameMatchers: ['h10'],
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
      skinTemperatureUi: false,
      ftuRequired: false,
    },
  },
} as const satisfies { [K in PolarProductId]: PolarProductEntry<K> };

/** Ordine overview / catalogo — solo prodotti con availability on. */
export const POLAR_PRODUCT_LIST: PolarProduct[] = (
  [
    POLAR_PRODUCTS.polar_360,
    POLAR_PRODUCTS.polar_loop,
    POLAR_PRODUCTS.polar_h10,
  ] as const
).filter((p) => isDeviceAvailable(p.id));

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

/** Catalog id for Ably / machine consumers; null if BLE name does not resolve. */
export function resolvePolarProductId(
  deviceName: string | null | undefined
): PolarProductId | null {
  return resolvePolarProduct(deviceName)?.id ?? null;
}
