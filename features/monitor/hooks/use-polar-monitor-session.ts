/**
 * Polar monitor helpers — PPI / HR metric shapes.
 * Session listeners live in useMonitorSession (shared effect with Muse/Ably).
 * Pass the session object; do not call useMonitorSession here.
 */

import type { PolarProduct } from "@/services/polar-products";
import type { RrSource } from "@/services/rr-interval";

export type PolarMonitorMetrics = {
  heartRate: number;
  hrv: number;
  lfPower: number;
  hfPower: number;
  rrMs: number;
  rrSource: RrSource | null;
  ecgMicroVolts: number;
  skinTemperatureC: number;
  connectedProduct: PolarProduct | null;
  isH10Connected: boolean;
  showRawEcgCards: boolean;
  isSkinTemperatureSupported: boolean;
};

export function selectPolarMonitorMetrics(session: PolarMonitorMetrics): PolarMonitorMetrics {
  return {
    heartRate: session.heartRate,
    hrv: session.hrv,
    lfPower: session.lfPower,
    hfPower: session.hfPower,
    rrMs: session.rrMs,
    rrSource: session.rrSource,
    ecgMicroVolts: session.ecgMicroVolts,
    skinTemperatureC: session.skinTemperatureC,
    connectedProduct: session.connectedProduct,
    isH10Connected: session.isH10Connected,
    showRawEcgCards: session.showRawEcgCards,
    isSkinTemperatureSupported: session.isSkinTemperatureSupported,
  };
}

/** @deprecated Prefer selectPolarMonitorMetrics(session) to avoid duplicate listeners. */
export function usePolarMonitorSession(): never {
  throw new Error(
    "usePolarMonitorSession must not mount a second session. Use selectPolarMonitorMetrics(useMonitorSession()) or read fields from the parent session."
  );
}
