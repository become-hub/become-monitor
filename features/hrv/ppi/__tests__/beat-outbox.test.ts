import {
  ackUpTo,
  bumpEpoch,
  createBeatOutbox,
  kindToCode,
  lastPendingSeq,
  markInFlight,
  nackFrom,
  nextFrame,
  pushBeat,
  selectPending,
} from "../beat-outbox";

describe("beat-outbox", () => {
  it("assegna seq monotoni e frameId / ep di sessione", () => {
    let box = createBeatOutbox();
    box = nextFrame(box);
    ({ outbox: box } = pushBeat(box, {
      ppiMs: 800,
      errorEstimate: 5,
      kind: "accepted",
      blocker: false,
    }));
    ({ outbox: box } = pushBeat(box, {
      ppiMs: 810,
      errorEstimate: 24,
      kind: "quality_rejected",
      blocker: true,
    }));
    expect(box.pending).toEqual([
      [1, 800, 5, 0, 0, 1, 1],
      [2, 810, 24, 1, 1, 1, 1],
    ]);
    expect(box.nextSeq).toBe(3);
  });

  it("bumpEpoch non azzera i pending e sopravvive al reset finestra", () => {
    let box = createBeatOutbox();
    box = nextFrame(box);
    ({ outbox: box } = pushBeat(box, {
      ppiMs: 800,
      errorEstimate: null,
      kind: "accepted",
      blocker: null,
    }));
    box = bumpEpoch(box);
    box = nextFrame(box);
    ({ outbox: box } = pushBeat(box, {
      ppiMs: 790,
      errorEstimate: 3,
      kind: "accepted",
      blocker: false,
    }));
    expect(box.ep).toBe(2);
    expect(box.pending.map((b) => [b[0], b[5], b[6]])).toEqual([
      [1, 1, 1],
      [2, 2, 2],
    ]);
  });

  it("selectPending rispetta il cap e ackUpTo svuota solo i confermati", () => {
    let box = createBeatOutbox();
    box = nextFrame(box);
    for (let i = 0; i < 5; i += 1) {
      ({ outbox: box } = pushBeat(box, {
        ppiMs: 800 + i,
        errorEstimate: 4,
        kind: "accepted",
        blocker: false,
      }));
    }
    expect(selectPending(box, 2)).toEqual([
      [1, 800, 4, 0, 0, 1, 1],
      [2, 801, 4, 0, 0, 1, 1],
    ]);
    expect(lastPendingSeq(box)).toBe(5);
    box = ackUpTo(box, 2);
    expect(box.pending.map((b) => b[0])).toEqual([3, 4, 5]);
    box = ackUpTo(box, 5);
    expect(box.pending).toEqual([]);
  });

  it("kindToCode mappa i tre kind", () => {
    expect(kindToCode("accepted")).toBe(0);
    expect(kindToCode("quality_rejected")).toBe(1);
    expect(kindToCode("out_of_physiological_range")).toBe(2);
  });

  it("markInFlight evita il rinvio durante un outage; nackFrom lo riabilita", () => {
    let box = createBeatOutbox();
    box = nextFrame(box);
    for (let i = 0; i < 4; i += 1) {
      ({ outbox: box } = pushBeat(box, {
        ppiMs: 800 + i,
        errorEstimate: 4,
        kind: "accepted",
        blocker: false,
      }));
    }
    const first = selectPending(box, 2);
    expect(first.map((b) => b[0])).toEqual([1, 2]);
    box = markInFlight(box, 2);
    // Ack non ancora arrivato: i beat 1-2 NON vengono rimandati.
    expect(selectPending(box, 2).map((b) => b[0])).toEqual([3, 4]);
    box = markInFlight(box, 4);
    expect(selectPending(box)).toEqual([]);
    expect(box.pending).toHaveLength(4);
    // Il publish dei beat 3-4 e' stato scartato: tornano selezionabili.
    box = nackFrom(box, 3);
    expect(selectPending(box).map((b) => b[0])).toEqual([3, 4]);
    // Ack dei beat 1-2: restano 3-4 in coda.
    box = ackUpTo(box, 2);
    expect(box.pending.map((b) => b[0])).toEqual([3, 4]);
  });

  it("markInFlight non arretra e nackFrom non avanza il cursore", () => {
    let box = createBeatOutbox();
    box = markInFlight(box, 10);
    expect(markInFlight(box, 5).inFlightUpTo).toBe(10);
    expect(nackFrom(box, 20).inFlightUpTo).toBe(10);
    expect(nackFrom(box, 4).inFlightUpTo).toBe(3);
  });
});
