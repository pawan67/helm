import { env } from "./env";

/**
 * Returns the local calendar date (YYYY-MM-DD) for a given instant in the
 * app's configured timezone. Used so "today" and streaks line up with the
 * user's wall clock rather than UTC.
 */
export function localDate(instant: Date, timeZone = env.timezone): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * The app-local wall clock for an instant: minutes since midnight (0–1439) and
 * weekday (0=Sun … 6=Sat). Drives the schedule matcher so "22:00 on weekdays"
 * lines up with the user's clock, not UTC.
 */
export function localClock(
  instant: Date,
  timeZone = env.timezone,
): { minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24; // some ICU builds emit "24" at midnight
  const minute = Number(get("minute"));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    get("weekday"),
  );
  return { minute: hour * 60 + minute, weekday };
}

/** Add (or subtract) whole days to a YYYY-MM-DD string, timezone-agnostic. */
export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Difference in whole days between two YYYY-MM-DD strings (a - b). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const au = Date.UTC(ay, am - 1, ad);
  const bu = Date.UTC(by, bm - 1, bd);
  return Math.round((au - bu) / 86400000);
}

/** Format milliseconds as m:ss or h:mm:ss. */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Human "2m 05s" style for hang durations. */
export function formatHang(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
