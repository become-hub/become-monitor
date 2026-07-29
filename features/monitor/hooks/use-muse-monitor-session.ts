/**
 * Muse monitor helpers — EEG / band metric shapes.
 * Session listeners live in useMonitorSession (shared effect with Polar/Ably).
 * Pass the session object; do not call useMonitorSession here.
 */

import type { MuseProduct } from "@/services/muse-products";

export type MuseMonitorMetrics = {
  eegTp9: number;
  eegAf7: number;
  eegAf8: number;
  eegTp10: number;
  bandDelta: number;
  bandTheta: number;
  bandAlpha: number;
  bandBeta: number;
  bandGamma: number;
  museHr: number;
  museBattery: number;
  connectedMuseProduct: MuseProduct | null;
  isMuseConnected: boolean;
};

export function selectMuseMonitorMetrics(session: MuseMonitorMetrics): MuseMonitorMetrics {
  return {
    eegTp9: session.eegTp9,
    eegAf7: session.eegAf7,
    eegAf8: session.eegAf8,
    eegTp10: session.eegTp10,
    bandDelta: session.bandDelta,
    bandTheta: session.bandTheta,
    bandAlpha: session.bandAlpha,
    bandBeta: session.bandBeta,
    bandGamma: session.bandGamma,
    museHr: session.museHr,
    museBattery: session.museBattery,
    connectedMuseProduct: session.connectedMuseProduct,
    isMuseConnected: session.isMuseConnected,
  };
}

/** @deprecated Prefer selectMuseMonitorMetrics(session) to avoid duplicate listeners. */
export function useMuseMonitorSession(): never {
  throw new Error(
    "useMuseMonitorSession must not mount a second session. Use selectMuseMonitorMetrics(useMonitorSession()) or read fields from the parent session."
  );
}
