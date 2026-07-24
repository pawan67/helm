import { describe, it, expect } from "vitest";
import { Detector, type DetectionEvent, type Sample } from "./detection";
import { DEFAULT_THRESHOLDS } from "../db/schema";

const DT = 50; // ms per sample

/** Builds a distance trace by holding values for durations. */
class Trace {
  private t = 0;
  private samples: Sample[] = [];
  hold(distanceMm: number, ms: number): this {
    const n = Math.round(ms / DT);
    for (let i = 0; i < n; i++) {
      this.samples.push({ t: this.t, distanceMm });
      this.t += DT;
    }
    return this;
  }
  build(): Sample[] {
    return this.samples;
  }
}

function run(samples: Sample[]): {
  events: DetectionEvent[];
  end: Extract<DetectionEvent, { type: "session_end" }> | undefined;
} {
  const det = new Detector(DEFAULT_THRESHOLDS);
  const events: DetectionEvent[] = [];
  for (const s of samples) events.push(...det.push(s));
  const end = events.find((e) => e.type === "session_end") as
    | Extract<DetectionEvent, { type: "session_end" }>
    | undefined;
  return { events, end };
}

// Distances relative to DEFAULT_THRESHOLDS: presenceMax 900, repNear 200,
// hysteresis 80 (must clear 280), minRep 400ms, release 1500ms, debounce 300ms.
const FAR = 1500;
const HANG = 700;
const TOP = 120;

describe("Detector", () => {
  it("counts a clean set of pull-ups", () => {
    const t = new Trace().hold(FAR, 400).hold(HANG, 700); // idle then grab
    for (let i = 0; i < 5; i++) {
      t.hold(TOP, 500).hold(HANG, 500); // pull up, lower down
    }
    t.hold(FAR, 2000); // let go -> session ends
    const { end } = run(t.build());
    expect(end).toBeDefined();
    expect(end!.reps).toBe(5);
  });

  it("records a dead hang with zero reps and long hang time", () => {
    const samples = new Trace()
      .hold(FAR, 400)
      .hold(HANG, 8000) // hang still, no reps
      .hold(FAR, 2000)
      .build();
    const { end } = run(samples);
    expect(end).toBeDefined();
    expect(end!.reps).toBe(0);
    expect(end!.hangMs).toBeGreaterThan(7000);
    expect(end!.maxHangMs).toBeGreaterThan(7000);
  });

  it("classifies via reps: pull-up set has reps, dead hang does not", () => {
    const set = run(
      new Trace()
        .hold(FAR, 400)
        .hold(HANG, 700)
        .hold(TOP, 500)
        .hold(HANG, 500)
        .hold(FAR, 2000)
        .build(),
    );
    expect(set.end!.reps).toBeGreaterThan(0);
  });

  it("ignores a walk-by shorter than the presence debounce", () => {
    const { events } = run(
      new Trace().hold(FAR, 400).hold(HANG, 150).hold(FAR, 600).build(),
    );
    expect(events.some((e) => e.type === "session_start")).toBe(false);
  });

  it("rejects reps faster than the minimum rep time", () => {
    const t = new Trace().hold(FAR, 400).hold(HANG, 700);
    // A very brief dip — below the 400ms floor.
    t.hold(TOP, 150).hold(HANG, 600).hold(FAR, 2000);
    const { end } = run(t.build());
    expect(end!.reps).toBe(0);
  });

  it("requires clearing the hysteresis band to count a rep", () => {
    const t = new Trace().hold(FAR, 400).hold(HANG, 700);
    t.hold(TOP, 500) // armed (below 200)
      .hold(250, 500) // rises but stays under 280 -> no count yet
      .hold(TOP, 500) // dips again, still same rep
      .hold(HANG, 500) // finally clears 280 -> exactly one rep
      .hold(FAR, 2000);
    const { end } = run(t.build());
    expect(end!.reps).toBe(1);
  });
});
