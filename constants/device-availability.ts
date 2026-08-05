/**
 * Product-level on/off for connect / pair / UI / docs visibility.
 * Flip a flag to re-enable a device without restoring deleted code.
 *
 * Full catalog definitions and SDK stacks stay integrated regardless of these flags.
 */

export const DEVICE_AVAILABILITY = {
  polar_360: true,
  polar_loop: true,
  polar_h10: false,
  muse_2: false,
} as const;

export type AvailableDeviceId = keyof typeof DEVICE_AVAILABILITY;

export function isDeviceAvailable(id: AvailableDeviceId): boolean {
  return DEVICE_AVAILABILITY[id];
}

export function isMuseFamilyAvailable(): boolean {
  return isDeviceAvailable("muse_2");
}
