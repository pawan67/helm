/**
 * Shared shapes + pure helpers for the ambient temperature/humidity history.
 * Kept free of Node/DB imports so client components can import the types too.
 */

export type EnvBucketUnit = "hour" | "day";

/** One aggregated point in the temperature/humidity series. */
export type EnvBucket = {
  /** ISO timestamp of the (local) bucket start, as a UTC instant. */
  at: string;
  tempAvg: number | null;
  tempMin: number | null;
  tempMax: number | null;
  humidityAvg: number | null;
};

export type EnvSeries = {
  /** How the points are bucketed, so the UI can label the axis appropriately. */
  unit: EnvBucketUnit;
  days: number;
  points: EnvBucket[];
  /** Most recent raw reading, or null if none stored yet. */
  current: { tempC: number | null; humidity: number | null; at: string } | null;
};

/** Short ranges get hourly detail; longer ones roll up to daily to stay readable. */
export function bucketFor(days: number): EnvBucketUnit {
  return days <= 7 ? "hour" : "day";
}

/** Clamp a requested range to something the UI offers (7 or 30 days). */
export function normalizeDays(days: number | undefined): number {
  if (days === 30) return 30;
  return 7;
}

/** Round to one decimal, preserving null (a sensor-read gap). */
export function round1(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}
