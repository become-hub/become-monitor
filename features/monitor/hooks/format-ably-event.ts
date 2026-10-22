/**
 * Human-readable view of the last Ably event published by the Monitor.
 * Long series (PPI window, resampled FFT input, ...) are summarized so the
 * popup stays readable; the real payload is never modified.
 */

import type { AblySendStats } from "@/services/ably-service";

/** Arrays longer than this are shown as a summary instead of one item per line. */
const MAX_INLINE_ARRAY_ITEMS = 6;

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== "object";
}

function summarizeArray(items: unknown[]): string {
  if (items.every(isPrimitive)) {
    const head = items.slice(0, 3).map((v) => JSON.stringify(v));
    const tail = items.slice(-2).map((v) => JSON.stringify(v));
    return `[${head.join(", ")}, … ${tail.join(", ")}] (${items.length} valori)`;
  }
  return `${items.length} elementi · primo: ${JSON.stringify(items[0])}`;
}

/** Pretty JSON (2 spaces) with long arrays summarized. */
export function formatAblyEventBody(message: Record<string, unknown>): string {
  return JSON.stringify(
    message,
    (_key, value) =>
      Array.isArray(value) && value.length > MAX_INLINE_ARRAY_ITEMS
        ? summarizeArray(value)
        : value,
    2
  );
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

export type AblyEventView = {
  title: string;
  /** One line: send time, size, totals. */
  meta: string;
  body: string;
};

/** Null when nothing has been sent yet. */
export function buildAblyEventView(stats: AblySendStats): AblyEventView | null {
  if (!stats.lastMessage) {
    return null;
  }
  const type =
    typeof stats.lastMessage.type === "string" ? stats.lastMessage.type : "evento";
  const parts: string[] = [];
  if (stats.lastSentAt != null) {
    parts.push(`inviato alle ${formatClock(stats.lastSentAt)}`);
  }
  parts.push(formatBytes(JSON.stringify(stats.lastMessage).length));
  parts.push(`${stats.sent} inviati`);
  if (stats.failed > 0) {
    parts.push(`${stats.failed} rifiutati`);
  }
  return {
    title: `Ultimo ${type}`,
    meta: parts.join(" · "),
    body: formatAblyEventBody(stats.lastMessage),
  };
}
