/**
 * Test catalogo Polar: matchers BLE + availability gate
 */

import {
  getPolarProductBadge,
  isSupportedPolarDevice,
  POLAR_PRODUCT_LIST,
  POLAR_PRODUCTS,
  resolvePolarProduct,
  resolvePolarProductId,
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

    it('non espone Polar H10 quando availability è off', () => {
      expect(resolvePolarProduct('Polar H10')).toBeNull();
      expect(resolvePolarProduct('POLAR H10 ABC')).toBeNull();
    });

    it('ignora dispositivi non supportati', () => {
      expect(resolvePolarProduct('Polar H9')).toBeNull();
      expect(resolvePolarProduct('Polar Sense')).toBeNull();
      expect(resolvePolarProduct('Unknown Device')).toBeNull();
      expect(resolvePolarProduct('')).toBeNull();
      expect(resolvePolarProduct(null)).toBeNull();
      expect(resolvePolarProduct(undefined)).toBeNull();
    });
  });

  describe('isSupportedPolarDevice', () => {
    it('true per 360 e Loop; false per H10 (gated)', () => {
      expect(isSupportedPolarDevice('Polar 360')).toBe(true);
      expect(isSupportedPolarDevice('Polar Loop')).toBe(true);
      expect(isSupportedPolarDevice('Polar H10')).toBe(false);
    });
  });

  describe('getPolarProductBadge', () => {
    it('restituisce display name o fallback', () => {
      expect(getPolarProductBadge('Polar 360 ABC')).toBe('Polar 360');
      expect(getPolarProductBadge('Polar Loop')).toBe('Polar Loop Gen 2');
      expect(getPolarProductBadge('Polar H10')).toBe('Polar');
      expect(getPolarProductBadge('Something')).toBe('Polar');
    });
  });

  describe('resolvePolarProductId', () => {
    it('restituisce PolarProductId o null', () => {
      expect(resolvePolarProductId('Polar 360 ABC')).toBe('polar_360');
      expect(resolvePolarProductId('Polar Loop')).toBe('polar_loop');
      expect(resolvePolarProductId('Polar H10')).toBeNull();
      expect(resolvePolarProductId('Something')).toBeNull();
    });
  });

  describe('POLAR_PRODUCT_LIST', () => {
    it('espone solo prodotti disponibili (360, Loop)', () => {
      expect(POLAR_PRODUCT_LIST.map((p) => p.id)).toEqual([
        'polar_360',
        'polar_loop',
      ]);
    });
  });

  describe('POLAR_PRODUCTS (catalogo completo)', () => {
    it('mantiene H10 definito con capabilities anche se gated', () => {
      expect(POLAR_PRODUCTS.polar_h10.id).toBe('polar_h10');
      expect(POLAR_PRODUCTS.polar_h10.capabilities.rawEcg).toBe(true);
      expect(POLAR_PRODUCTS.polar_h10.capabilities.ftuRequired).toBe(false);
      expect(POLAR_PRODUCTS.polar_h10.capabilities.ppi).toBe(false);
    });

    it('nasconde skin temp UI su 360; la mostra su Loop (stream+UI)', () => {
      expect(POLAR_PRODUCTS.polar_360.capabilities.skinTemperature).toBe(false);
      expect(POLAR_PRODUCTS.polar_360.capabilities.skinTemperatureUi).toBe(false);
      expect(POLAR_PRODUCTS.polar_loop.capabilities.skinTemperature).toBe(true);
      expect(POLAR_PRODUCTS.polar_loop.capabilities.skinTemperatureUi).toBe(true);
    });
  });
});
