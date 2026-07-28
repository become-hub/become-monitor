import * as Sentry from "@sentry/react-native";

const FALLBACK_SENTRY_DSN =
  "https://28129c667787ac32ffae62828866d41b@o4504892857516032.ingest.us.sentry.io/4511814456836096";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? FALLBACK_SENTRY_DSN;

/**
 * Logging-focused Sentry setup: fire-and-forget, no tracing/replay/app-hang
 * so the SDK never stalls BLE / foreground monitoring flows.
 */
export function initSentry(): void {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    enabled: true,
    environment: __DEV__ ? "development" : "production",
    enableLogs: true,
    // No performance / profiling / replay — omit sample rates to disable tracing entirely.
    enableAutoPerformanceTracing: false,
    // Avoid native hang/watchdog paths that can interfere with long-running work.
    enableAppHangTracking: false,
    enableWatchdogTerminationTracking: false,
    enableNativeFramesTracking: false,
    sendDefaultPii: false,
  });
}

/** Non-blocking log. Never throws; safe to call from hot paths. */
export function logToSentry(
  message: string,
  level: "debug" | "info" | "warn" | "error" = "info",
  attributes?: Record<string, string | number | boolean>,
): void {
  if (!dsn) {
    return;
  }

  try {
    const logger = Sentry.logger;
    switch (level) {
      case "debug":
        logger.debug(message, attributes);
        break;
      case "warn":
        logger.warn(message, attributes);
        break;
      case "error":
        logger.error(message, attributes);
        break;
      default:
        logger.info(message, attributes);
    }
  } catch {
    // Swallow — logging must never affect app execution.
  }
}

/** Non-blocking exception report. Does not rethrow. */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!dsn) {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  } catch {
    // Swallow — reporting must never affect app execution.
  }
}

export { Sentry };
