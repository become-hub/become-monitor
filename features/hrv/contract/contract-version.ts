/** Ably Polar heartRate / sessionMeta schema version (breaking changes bump this). */
export const POLAR_PAYLOAD_SCHEMA_VERSION = 2 as const;

/**
 * Frozen HRV algorithm id. Bump (hrv-2, …) when thresholds or the spectral
 * pipeline change; keep previous ids in the recompute algo-registry.
 */
export const POLAR_ALGO_VERSION = "hrv-1" as const;

export type PolarPayloadSchemaVersion = typeof POLAR_PAYLOAD_SCHEMA_VERSION;
export type PolarAlgoVersion = typeof POLAR_ALGO_VERSION;
