/**
 * Reference recorder (developer validation).
 *
 * Collects, on ONE wall clock, the primary device beats (360/Loop PPI) and the RR intervals of a
 * reference chest strap (Polar H10) so LF/HF can be compared offline without a second phone.
 *
 * Pure and passive: it never feeds the live LF/HF window, the beat outbox or Ably.
 * Rows are recorded only while [setActive] is true.
 */

export type ReferenceRecorderSource = "primary" | "reference";

export type ReferenceRecorderRow =
  | {
      source: "primary";
      /** Wall-clock ms of the SDK frame that carried this beat. */
      tMs: number;
      seq: number;
      ppiMs: number;
      kind: string;
    }
  | {
      source: "reference";
      /** Wall-clock ms taken natively when the HR packet left the SDK. */
      tMs: number;
      rrMs: number;
      hr: number;
    };

export type ReferenceRecorderSummary = {
  active: boolean;
  primaryBeats: number;
  referenceBeats: number;
  firstMs: number | null;
  lastMs: number | null;
  dropped: number;
};

export const REFERENCE_RECORDER_MAX_ROWS = 100_000;

export const REFERENCE_RECORDER_CSV_HEADER =
  "source,t_ms,t_iso,seq,value_ms,hr,kind";

export function createReferenceRecorder(
  maxRows: number = REFERENCE_RECORDER_MAX_ROWS
) {
  let rows: ReferenceRecorderRow[] = [];
  let active = false;
  let dropped = 0;

  const push = (row: ReferenceRecorderRow) => {
    if (!active) return;
    if (rows.length >= maxRows) {
      dropped += 1;
      return;
    }
    rows.push(row);
  };

  return {
    setActive(value: boolean) {
      active = value;
    },

    isActive() {
      return active;
    },

    recordPrimaryBeat(beat: {
      tMs: number;
      seq: number;
      ppiMs: number;
      kind: string;
    }) {
      push({ source: "primary", ...beat });
    },

    /** One H10 HR packet; each RR in it becomes a row sharing the packet time. */
    recordReferencePacket(packet: {
      tMs: number;
      hr: number;
      rrsMs?: number[] | null;
    }) {
      for (const rrMs of packet.rrsMs ?? []) {
        if (!Number.isFinite(rrMs) || rrMs <= 0) continue;
        push({ source: "reference", tMs: packet.tMs, rrMs, hr: packet.hr });
      }
    },

    clear() {
      rows = [];
      dropped = 0;
    },

    getRows(): readonly ReferenceRecorderRow[] {
      return rows;
    },

    getSummary(): ReferenceRecorderSummary {
      let primaryBeats = 0;
      let referenceBeats = 0;
      let firstMs: number | null = null;
      let lastMs: number | null = null;
      for (const row of rows) {
        if (row.source === "primary") primaryBeats += 1;
        else referenceBeats += 1;
        if (firstMs === null || row.tMs < firstMs) firstMs = row.tMs;
        if (lastMs === null || row.tMs > lastMs) lastMs = row.tMs;
      }
      return { active, primaryBeats, referenceBeats, firstMs, lastMs, dropped };
    },

    toCsv(): string {
      const lines = [REFERENCE_RECORDER_CSV_HEADER];
      for (const row of rows) {
        const iso = new Date(row.tMs).toISOString();
        if (row.source === "primary") {
          lines.push(
            `primary,${row.tMs},${iso},${row.seq},${row.ppiMs},,${row.kind}`
          );
        } else {
          lines.push(`reference,${row.tMs},${iso},,${row.rrMs},${row.hr},ecg_rr`);
        }
      }
      return lines.join("\n");
    },
  };
}

export type ReferenceRecorder = ReturnType<typeof createReferenceRecorder>;

/** Shared instance: the monitor session feeds it, the reference UI reads it. */
export const referenceRecorder: ReferenceRecorder = createReferenceRecorder();
