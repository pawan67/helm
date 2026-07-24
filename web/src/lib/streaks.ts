import { addDays, diffDays } from "./time";

export type DayRecord = {
  date: string; // YYYY-MM-DD
  totalReps: number;
  goalReps: number;
};

/**
 * A day "counts" toward a streak if it met its rep goal (goal > 0 and reps >=
 * goal). Pure function so it is easy to unit-test with synthetic data.
 *
 * @param days   all day records (any order)
 * @param today  the current local date (YYYY-MM-DD)
 * @returns current streak length ending on today or yesterday, and best-ever.
 */
export function computeStreaks(
  days: DayRecord[],
  today: string,
): { current: number; best: number } {
  const metDates = new Set(
    days
      .filter((d) => d.goalReps > 0 && d.totalReps >= d.goalReps)
      .map((d) => d.date),
  );

  // Current streak: walk backwards from today (allowing today to be unfinished:
  // start from today if met, else from yesterday).
  let current = 0;
  let cursor = metDates.has(today) ? today : addDays(today, -1);
  while (metDates.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Best streak ever: sort met dates and find the longest consecutive run.
  const sorted = [...metDates].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev !== null && diffDays(d, prev) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }

  return { current, best };
}

/** Sum reps over the trailing 7 days including today. */
export function weeklyReps(days: DayRecord[], today: string): number {
  const start = addDays(today, -6);
  return days
    .filter((d) => d.date >= start && d.date <= today)
    .reduce((sum, d) => sum + d.totalReps, 0);
}
