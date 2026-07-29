/**
 * Building blocks Polar (360 / Loop / H10): FTU readiness + product streaming.
 * Pura logica senza UI React — riusabile da monitor e future integrazioni.
 */

import type { PolarProduct } from "./polar-products";

export type PolarReadyStatus = "ready" | "deferred" | "failed";

export type PolarReadyResult =
  | { status: "ready" }
  | { status: "deferred" }
  | { status: "failed"; error?: string };

export interface PolarReadyOptions {
  /** Default true — stesso flusso 360/Loop. H10: false. */
  requireFtu?: boolean;
}

/** Subset del bridge Polar usato da questi helper. */
export interface PolarSetupSdk {
  ensureFirstTimeUse(deviceId: string): Promise<{ performed: boolean }>;
  startPpiStreaming(deviceId: string): Promise<void>;
  startHrStreaming?(deviceId: string): Promise<void>;
  startEcgStreaming?(deviceId: string): Promise<void>;
  startSkinTemperatureStreaming?(deviceId: string): Promise<void>;
}

export interface PolarStreamingResult {
  ppi: boolean;
  hr: boolean;
  ecg: boolean;
}

/**
 * Assicura FTU quando richiesto. Se appena eseguito (device in restart) → deferred.
 * Con `requireFtu: false` (H10) ritorna subito ready senza chiamare il nativo.
 */
export async function ensurePolarReady(
  deviceId: string,
  sdk: PolarSetupSdk,
  options: PolarReadyOptions = {}
): Promise<PolarReadyResult> {
  const requireFtu = options.requireFtu !== false;
  if (!requireFtu) {
    return { status: "ready" };
  }

  try {
    const ftuResult = await sdk.ensureFirstTimeUse(deviceId);
    if (ftuResult.performed) {
      return { status: "deferred" };
    }
    return { status: "ready" };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error ?? "FTU failed");
    return { status: "failed", error: message };
  }
}

/**
 * Avvia PPI; se fallisce resta il fallback HR (nessun throw).
 * @returns true se PPI avviato, false se fallback HR
 */
export async function startPpiStreamingWithFallback(
  deviceId: string,
  sdk: PolarSetupSdk,
  log: Pick<Console, "log"> = console
): Promise<boolean> {
  try {
    await sdk.startPpiStreaming(deviceId);
    log.log("✅ PPI streaming avviato con successo!");
    return true;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error ?? "PPI error");
    log.log("⚠️ PPI non disponibile:", message);
    log.log("🔄 Usando modalità fallback: HRV calcolato da HR");
    return false;
  }
}

/**
 * Avvia streaming in base alle capabilities prodotto.
 * 360/Loop → PPI (+ fallback HR). H10 → HR nativo + ECG (no PPI/FTU).
 */
export async function startPolarStreamingForProduct(
  product: PolarProduct,
  deviceId: string,
  sdk: PolarSetupSdk,
  log: Pick<Console, "log"> = console
): Promise<PolarStreamingResult> {
  if (product.capabilities.ppi) {
    const ppi = await startPpiStreamingWithFallback(deviceId, sdk, log);

    // 360/Loop can expose skin temperature (online streaming).
    if (product.capabilities.skinTemperature && sdk.startSkinTemperatureStreaming) {
      try {
        await sdk.startSkinTemperatureStreaming(deviceId);
        log.log("✅ Skin temperature streaming avviato");
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : String(error ?? "Skin temperature streaming error");
        log.log("⚠️ Skin temperature streaming non disponibile:", message);
      }
    }
    return { ppi, hr: false, ecg: false };
  }

  if (product.capabilities.ecg && product.capabilities.rawEcg) {
    let hr = false;
    let ecg = false;

    if (sdk.startHrStreaming) {
      try {
        await sdk.startHrStreaming(deviceId);
        hr = true;
        log.log("✅ HR streaming (RR nativi) avviato");
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error ?? "HR error");
        log.log("⚠️ HR streaming non disponibile:", message);
      }
    }

    if (sdk.startEcgStreaming) {
      try {
        await sdk.startEcgStreaming(deviceId);
        ecg = true;
        log.log("✅ ECG streaming avviato");
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error ?? "ECG error");
        log.log("⚠️ ECG streaming non disponibile:", message);
      }
    }

    return { ppi: false, hr, ecg };
  }

  return { ppi: false, hr: false, ecg: false };
}
