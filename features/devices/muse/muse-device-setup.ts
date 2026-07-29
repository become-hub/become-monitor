/**
 * Muse setup helpers — streaming only (no FTU). Parallel to polar-device-setup.
 */

import type { MuseProduct } from "./muse-products";
import { logToSentry } from "@/services/sentry";

export interface MuseSetupSdk {
  startEegStreaming(): Promise<void>;
  startPpgStreaming?(): Promise<void>;
}

export interface MuseStreamingResult {
  eeg: boolean;
  ppg: boolean;
}

/**
 * Avvia streaming Muse in base alle capabilities (EEG + PPG/HR).
 * Non tocca Polar. Errori → Sentry (non bloccante), flusso continua.
 */
export async function startMuseStreamingForProduct(
  product: MuseProduct,
  sdk: MuseSetupSdk,
  log: Pick<Console, "log"> = console
): Promise<MuseStreamingResult> {
  let eeg = false;
  let ppg = false;

  if (product.capabilities.eeg) {
    try {
      await sdk.startEegStreaming();
      eeg = true;
      log.log("✅ Muse EEG streaming avviato");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error ?? "EEG error");
      log.log("⚠️ Muse EEG streaming non disponibile:", message);
      logToSentry("Muse EEG streaming unavailable", "error", {
        deviceFamily: "muse",
        productId: product.id,
        error: message,
      });
    }
  }

  if (product.capabilities.ppg && sdk.startPpgStreaming) {
    try {
      await sdk.startPpgStreaming();
      ppg = true;
      log.log("✅ Muse PPG/HR streaming avviato");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error ?? "PPG error");
      log.log("⚠️ Muse PPG streaming non disponibile:", message);
      logToSentry("Muse PPG streaming unavailable", "error", {
        deviceFamily: "muse",
        productId: product.id,
        error: message,
      });
    }
  }

  return { eeg, ppg };
}
