import { describe, it, expect } from "vitest";
import { computeStreaks, weeklyReps, type DayRecord } from "./streaks";

const d = (date: string, reps: number, goal = 50): DayRecord => ({
  date,
  totalReps: reps,
  goalReps: goal,
});

describe("computeStreaks", () => {
  it("counts a current streak ending today", () => {
    const days = [
      d("2026-07-22", 60),
      d("2026-07-23", 55),
      d("2026-07-24", 50),
    ];
    const { current, best } = computeStreaks(days, "2026-07-24");
    expect(current).toBe(3);
    expect(best).toBe(3);
  });

  it("keeps the streak alive if today is unfinished but yesterday hit", () => {
    const days = [d("2026-07-22", 60), d("2026-07-23", 55), d("2026-07-24", 10)];
    const { current } = computeStreaks(days, "2026-07-24");
    expect(current).toBe(2); // today not yet met, streak through yesterday
  });

  it("breaks the streak on a missed day and reports best", () => {
    const days = [
      d("2026-07-20", 60),
      d("2026-07-21", 60),
      d("2026-07-22", 10), // miss
      d("2026-07-23", 60),
      d("2026-07-24", 60),
    ];
    const { current, best } = computeStreaks(days, "2026-07-24");
    expect(current).toBe(2);
    expect(best).toBe(2);
  });

  it("does not count days with no goal", () => {
    const days = [d("2026-07-24", 100, 0)];
    const { current } = computeStreaks(days, "2026-07-24");
    expect(current).toBe(0);
  });
});

describe("weeklyReps", () => {
  it("sums the trailing 7 days inclusive", () => {
    const days = [
      d("2026-07-17", 10), // 7 days before -> excluded (outside window start)
      d("2026-07-18", 20),
      d("2026-07-24", 30),
    ];
    // window is 2026-07-18 .. 2026-07-24
    expect(weeklyReps(days, "2026-07-24")).toBe(50);
  });
});
