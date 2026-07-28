/**
 * Building blocks Polar (360 / Loop Gen 2): FTU readiness + PPI streaming.
 * Pura logica senza UI React — riusabile da monitor e future integrazioni.
 */

export type PolarReadyStatus = "ready" | "deferred" | "failed";

export type PolarReadyResult =
  | { status: "ready" }
  | { status: "deferred" }
  | { status: "failed"; error?: string };

/** Subset del bridge Polar usato da questi helper. */
export interface PolarSetupSdk {
  ensureFirstTimeUse(deviceId: string): Promise<{ performed: boolean }>;
  startPpiStreaming(deviceId: string): Promise<void>;
}

/**
 * Assicura FTU. Se appena eseguito (device in restart) → deferred.
 */
export async function ensurePolarReady(
  deviceId: string,
  sdk: PolarSetupSdk
): Promise<PolarReadyResult> {
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
