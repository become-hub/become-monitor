/**
 * Reference device (developer validation): a Polar H10 chest strap used next to a 360/Loop
 * to compare RR / LF/HF on the same phone clock.
 *
 * It is NOT gated by DEVICE_AVAILABILITY.polar_h10 — that flag controls the primary-device
 * catalog. The reference path is only reachable in Developer Mode and never feeds Ably or LF/HF.
 */

import { POLAR_PRODUCTS } from "./polar-products";

export function isPolarReferenceCandidate(
  deviceName: string | null | undefined
): boolean {
  if (!deviceName) {
    return false;
  }
  const normalized = deviceName.toLowerCase();
  return POLAR_PRODUCTS.polar_h10.bleNameMatchers.some((matcher) =>
    normalized.includes(matcher.toLowerCase())
  );
}
