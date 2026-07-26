/**
 * Pure schedule helpers — shared by the server (scheduler, API) and the client
 * (schedules UI). No Node imports so it can be bundled into client components.
 *
 * A schedule is ONE timed action: at a local time, on chosen weekdays, run an
 * action against an IR device. "Turn AC on at 22:00 / off at 06:00" is two
 * schedules — like two cron lines — which keeps the model flat and flexible.
 */
import type { ClimatePatch } from "./ir-climate";

/** What a schedule does when it fires. */
export type ScheduleAction =
  | { kind: "climate"; patch: ClimatePatch }
  | { kind: "button"; buttonId: string };

/** Sun-first, matching JS `Date.getDay()` and the scheduler's weekday index. */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** minutes-since-local-midnight → "HH:MM". */
export function minuteToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "HH:MM" → minutes-since-midnight, or null if malformed / out of range. */
export function hhmmToMinute(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Human label for a weekday set: "Every day" / "Weekdays" / "Mon, Wed, Fri". */
export function daysLabel(days: number[]): string {
  if (days.length === 0 || days.length === 7) return "Every day";
  const set = new Set(days);
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Weekdays";
  if (set.size === 2 && [0, 6].every((d) => set.has(d))) return "Weekends";
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAYS[d]).join(", ");
}
