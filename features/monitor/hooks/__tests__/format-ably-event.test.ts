import type { AblySendStats } from "@/services/ably-service";
import { buildAblyEventView, formatAblyEventBody } from "../format-ably-event";

const baseStats: AblySendStats = {
  sent: 12,
  failed: 0,
  lastMessage: null,
  lastSentAt: null,
  lastError: null,
};

describe("formatAblyEventBody", () => {
  it("indenta il JSON e lascia intatti gli array corti", () => {
    const body = formatAblyEventBody({ hr: 70, rrsMs: [800, 810] });
    expect(body).toBe(
      JSON.stringify({ hr: 70, rrsMs: [800, 810] }, null, 2)
    );
  });

  it("riassume gli array lunghi di numeri", () => {
    const series = Array.from({ length: 50 }, (_, i) => 800 + i);
    const parsed = JSON.parse(formatAblyEventBody({ ppisMs: series }));
    expect(parsed.ppisMs).toBe("[800, 801, 802, … 848, 849] (50 valori)");
  });

  it("riassume gli array lunghi di oggetti con il primo elemento", () => {
    const samples = Array.from({ length: 20 }, (_, i) => ({ ppiMs: 800 + i }));
    const parsed = JSON.parse(formatAblyEventBody({ ppiSamples: samples }));
    expect(parsed.ppiSamples).toBe('20 elementi · primo: {"ppiMs":800}');
  });

  it("non modifica il messaggio originale", () => {
    const series = Array.from({ length: 50 }, (_, i) => i);
    const message = { ppisMs: series };
    formatAblyEventBody(message);
    expect(message.ppisMs).toHaveLength(50);
  });
});

describe("buildAblyEventView", () => {
  it("è null se non è stato inviato nulla", () => {
    expect(buildAblyEventView(baseStats)).toBeNull();
  });

  it("compone titolo, meta e corpo", () => {
    const view = buildAblyEventView({
      ...baseStats,
      failed: 2,
      lastMessage: { type: "heartRate", hr: 64 },
      lastSentAt: new Date(2026, 9, 22, 13, 5, 9).getTime(),
    });
    expect(view).not.toBeNull();
    expect(view!.title).toBe("Ultimo heartRate");
    expect(view!.meta).toContain("inviato alle 13:05:09");
    expect(view!.meta).toContain("12 inviati");
    expect(view!.meta).toContain("2 rifiutati");
    expect(JSON.parse(view!.body)).toEqual({ type: "heartRate", hr: 64 });
  });
});
