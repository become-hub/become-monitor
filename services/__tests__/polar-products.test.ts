/**
 * Test catalogo Polar: matchers BLE 360 / Loop / H10
 */

import {
  getPolarProductBadge,
  isSupportedPolarDevice,
  POLAR_PRODUCT_LIST,
  resolvePolarProduct,
} from '../polar-products';

describe('polar-products', () => {
  describe('resolvePolarProduct', () => {
    it('riconosce Polar 360', () => {
      expect(resolvePolarProduct('Polar 360')?.id).toBe('polar_360');
      expect(resolvePolarProduct('Polar 360 A1B2C3')?.id).toBe('polar_360');
      expect(resolvePolarProduct('POLAR 360')?.id).toBe('polar_360');
    });

    it('riconosce Polar Loop Gen 2', () => {
      expect(resolvePolarProduct('Polar Loop')?.id).toBe('polar_loop');
      expect(resolvePolarProduct('Polar Loop Gen 2')?.id).toBe('polar_loop');
      expect(resolvePolarProduct('polar loop xyz')?.id).toBe('polar_loop');
    });

    it('ignora H10 e dispositivi non supportati', () => {
      expect(resolvePolarProduct('Polar H10')).toBeNull();
      expect(resolvePolarProduct('Polar H9')).toBeNull();
      expect(resolvePolarProduct('Polar Sense')).toBeNull();
      expect(resolvePolarProduct('Unknown Device')).toBeNull();
      expect(resolvePolarProduct('')).toBeNull();
      expect(resolvePolarProduct(null)).toBeNull();
      expect(resolvePolarProduct(undefined)).toBeNull();
    });
  });

  describe('isSupportedPolarDevice', () => {
    it('true solo per 360 e Loop', () => {
      expect(isSupportedPolarDevice('Polar 360')).toBe(true);
      expect(isSupportedPolarDevice('Polar Loop')).toBe(true);
      expect(isSupportedPolarDevice('Polar H10')).toBe(false);
    });
  });

  describe('getPolarProductBadge', () => {
    it('restituisce display name o fallback', () => {
      expect(getPolarProductBadge('Polar 360 ABC')).toBe('Polar 360');
      expect(getPolarProductBadge('Polar Loop')).toBe('Polar Loop');
      expect(getPolarProductBadge('Something')).toBe('Polar');
    });
  });

  describe('POLAR_PRODUCT_LIST', () => {
    it('espone 360 e Loop in ordine', () => {
      expect(POLAR_PRODUCT_LIST.map((p) => p.id)).toEqual([
        'polar_360',
        'polar_loop',
      ]);
    });
  });
});
