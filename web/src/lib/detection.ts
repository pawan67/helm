import type { DetectionThresholds } from "@/db/schema";

/**
 * Pure, framework-free reference implementation of the rep/hang detection state
 * machine. The Arduino firmware implements the identical logic in C++; keeping a
 * TypeScript twin lets us unit-test the algorithm against synthetic distance
 * traces and drive the mock device without hardware.
 */

export type DetectionState = "idle" | "hanging" | "rep_up";

export type DetectionEvent =
  | { type: "session_start"; at: number }
  | { type: "rep"; at: number; repNumber: number; upDurationMs: number }
  | {
      type: "session_end";
      at: number;
      reps: number;
      hangMs: number;
      durationMs: number;
      maxHangMs: number;
      repTimings: { repNumber: number; at: number; upDurationMs: number }[];
    };

export type Sample = { t: number; distanceMm: number };

type Internal = {
  state: DetectionState;
  presentSince: number | null; // when a close reading first appeared (debounce)
  absentSince: number | null; // when readings first went out of range
  sessionStart: number | null;
  reps: number;
  hangMs: number;
  maxHangMs: number;
  hangSegmentStart: number | null; // start of current continuous hang segment
  lastSampleT: number | null;
  repStart: number | null; // when the current up-phase crossed REP_NEAR
  repTimings: { repNumber: number; at: number; upDurationMs: number }[];
};

export class Detector {
  private t: DetectionThresholds;
  private i: Internal;
  private window: number[] = [];
  private windowSize: number;

  constructor(thresholds: DetectionThresholds, medianWindow = 5) {
    this.t = thresholds;
    this.windowSize = medianWindow;
    this.i = this.reset();
  }

  private reset(): Internal {
    return {
      state: "idle",
      presentSince: null,
      absentSince: null,
      sessionStart: null,
      reps: 0,
      hangMs: 0,
      maxHangMs: 0,
      hangSegmentStart: null,
      lastSampleT: null,
      repStart: null,
      repTimings: [],
    };
  }

  get state(): DetectionState {
    return this.i.state;
  }

  get reps(): number {
    return this.i.reps;
  }

  /** Median-smooth raw readings to reject VL53L0X spikes. */
  private smooth(distanceMm: number): number {
    this.window.push(distanceMm);
    if (this.window.length > this.windowSize) this.window.shift();
    const sorted = [...this.window].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  /**
   * Feed one sample; returns any events produced by this sample.
   */
  push(sample: Sample): DetectionEvent[] {
    const events: DetectionEvent[] = [];
    const d = this.smooth(sample.distanceMm);
    const now = sample.t;
    const t = this.t;
    const present = d < t.presenceMaxMm;

    // Accumulate hang time (time on bar not mid-rep) while hanging.
    if (this.i.state === "hanging" && this.i.lastSampleT !== null) {
      const dt = now - this.i.lastSampleT;
      if (dt > 0) this.i.hangMs += dt;
    }
    this.i.lastSampleT = now;

    switch (this.i.state) {
      case "idle": {
        if (present) {
          if (this.i.presentSince === null) this.i.presentSince = now;
          if (now - this.i.presentSince >= t.presenceDebounceMs) {
            // Session begins.
            this.i = { ...this.reset(), lastSampleT: now };
            this.i.state = "hanging";
            this.i.sessionStart = now;
            this.i.hangSegmentStart = now;
            events.push({ type: "session_start", at: now });
          }
        } else {
          this.i.presentSince = null;
        }
        break;
      }

      case "hanging": {
        if (d < t.repNearMm) {
          // Crossed into the "top of rep" zone.
          this.finishHangSegment(now);
          this.i.state = "rep_up";
          this.i.repStart = now;
        } else if (!present) {
          this.handleAbsence(now, events);
        } else {
          this.i.absentSince = null;
        }
        break;
      }

      case "rep_up": {
        // Re-arm only after rising a hysteresis margin above REP_NEAR.
        if (d > t.repNearMm + t.repHysteresisMm) {
          const dur = this.i.repStart !== null ? now - this.i.repStart : 0;
          if (dur >= t.minRepMs) {
            this.i.reps += 1;
            this.i.repTimings.push({
              repNumber: this.i.reps,
              at: now,
              upDurationMs: dur,
            });
            events.push({
              type: "rep",
              at: now,
              repNumber: this.i.reps,
              upDurationMs: dur,
            });
          }
          this.i.repStart = null;
          this.i.state = "hanging";
          this.i.hangSegmentStart = now;
        }
        break;
      }
    }

    return events;
  }

  private handleAbsence(now: number, events: DetectionEvent[]) {
    if (this.i.absentSince === null) this.i.absentSince = now;
    if (now - this.i.absentSince >= this.t.releaseMs) {
      this.endSession(this.i.absentSince, events);
    }
  }

  private finishHangSegment(now: number) {
    if (this.i.hangSegmentStart !== null) {
      const seg = now - this.i.hangSegmentStart;
      if (seg > this.i.maxHangMs) this.i.maxHangMs = seg;
      this.i.hangSegmentStart = null;
    }
  }

  private endSession(endAt: number, events: DetectionEvent[]) {
    this.finishHangSegment(endAt);
    const start = this.i.sessionStart ?? endAt;
    events.push({
      type: "session_end",
      at: endAt,
      reps: this.i.reps,
      hangMs: Math.round(this.i.hangMs),
      durationMs: endAt - start,
      maxHangMs: Math.round(this.i.maxHangMs),
      repTimings: this.i.repTimings,
    });
    this.i = this.reset();
    this.window = [];
  }
}
