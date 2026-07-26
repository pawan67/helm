import { desc, gte, eq, and, sql as dsql } from "drizzle-orm";
import { db } from "./index";
import {
  sessions,
  dailyStats,
  personalRecords,
  repEvents,
  envReadings,
} from "./schema";
import { getSettings } from "./persist";
import { computeStreaks, weeklyReps, type DayRecord } from "@/lib/streaks";
import { localDate, addDays } from "@/lib/time";
import { env } from "@/lib/env";
import {
  bucketFor,
  normalizeDays,
  round1,
  type EnvSeries,
} from "@/lib/env-series";

export async function getRecentSessions(limit = 20) {
  return db.select().from(sessions).orderBy(desc(sessions.startedAt)).limit(limit);
}

export type SessionFilter = {
  type?: "pullup_set" | "dead_hang";
  /** Inclusive local calendar date (YYYY-MM-DD). */
  from?: string;
  /** Inclusive local calendar date (YYYY-MM-DD). */
  to?: string;
  limit?: number;
  offset?: number;
};

/**
 * A filtered, paginated slice of sessions (newest first) plus the total row
 * count that matches the filter — so the client can page without re-counting.
 * Date bounds compare against the session's *local* calendar day (the same
 * timezone the rollups use), not the raw UTC instant.
 */
export async function getSessionsPage(filter: SessionFilter = {}) {
  const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
  const offset = Math.max(0, filter.offset ?? 0);
  const tz = env.timezone;
  const localDay = dsql`(${sessions.startedAt} AT TIME ZONE ${tz})::date`;

  const conds = [];
  if (filter.type) conds.push(eq(sessions.type, filter.type));
  if (filter.from) conds.push(dsql`${localDay} >= ${filter.from}::date`);
  if (filter.to) conds.push(dsql`${localDay} <= ${filter.to}::date`);
  const where = conds.length ? and(...conds) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(sessions)
      .where(where)
      .orderBy(desc(sessions.startedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: dsql<number>`count(*)::int` })
      .from(sessions)
      .where(where),
  ]);

  return { rows, total };
}

export async function getSessionWithReps(id: string) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session) return null;
  const reps = await db
    .select()
    .from(repEvents)
    .where(eq(repEvents.sessionId, id))
    .orderBy(repEvents.repNumber);
  return { session, reps };
}

/** Last `days` of daily rollups (ascending by date). */
export async function getDailyStats(days = 30) {
  const from = addDays(localDate(new Date()), -(days - 1));
  const rows = await db
    .select()
    .from(dailyStats)
    .where(gte(dailyStats.date, from))
    .orderBy(dailyStats.date);
  return rows;
}

export async function getRecords() {
  return db.select().from(personalRecords);
}

/**
 * Ambient temperature/humidity history for the Environment view. Buckets raw
 * env_readings by hour (<=7d) or day (>7d) in the app timezone, returning
 * avg/min/max temperature and avg humidity per bucket plus the latest reading.
 */
export async function getEnvSeries(days = 7): Promise<EnvSeries> {
  const range = normalizeDays(days);
  const unit = bucketFor(range);
  const tz = env.timezone;
  const from = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

  // Truncate in local time, then re-anchor to a UTC instant for stable ISO output.
  // Group/order by the select ordinal (1) rather than repeating the expression —
  // drizzle would otherwise emit distinct bind params in SELECT vs GROUP BY and
  // Postgres wouldn't see them as the same expression.
  const bucket = dsql<Date>`(date_trunc(${unit}, ${envReadings.at} AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`;

  const rows = await db
    .select({
      at: bucket,
      tempAvg: dsql<number | null>`avg(${envReadings.tempC})::float8`,
      tempMin: dsql<number | null>`min(${envReadings.tempC})::float8`,
      tempMax: dsql<number | null>`max(${envReadings.tempC})::float8`,
      humidityAvg: dsql<number | null>`avg(${envReadings.humidity})::float8`,
    })
    .from(envReadings)
    .where(gte(envReadings.at, from))
    .groupBy(dsql`1`)
    .orderBy(dsql`1`);

  const [latest] = await db
    .select({
      tempC: envReadings.tempC,
      humidity: envReadings.humidity,
      at: envReadings.at,
    })
    .from(envReadings)
    .orderBy(desc(envReadings.at))
    .limit(1);

  return {
    unit,
    days: range,
    points: rows.map((r) => ({
      at: new Date(r.at).toISOString(),
      tempAvg: round1(r.tempAvg),
      tempMin: round1(r.tempMin),
      tempMax: round1(r.tempMax),
      humidityAvg: round1(r.humidityAvg),
    })),
    current: latest
      ? {
          tempC: round1(latest.tempC),
          humidity: round1(latest.humidity),
          at: new Date(latest.at).toISOString(),
        }
      : null,
  };
}

/** Everything the dashboard needs in one call. */
export async function getDashboardSummary() {
  const today = localDate(new Date());
  const settings = await getSettings();

  const allDays = await db
    .select({
      date: dailyStats.date,
      totalReps: dailyStats.totalReps,
      totalHangMs: dailyStats.totalHangMs,
      goalReps: dailyStats.goalReps,
    })
    .from(dailyStats)
    .orderBy(dailyStats.date);

  const dayRecords: DayRecord[] = allDays.map((d) => ({
    date: d.date,
    totalReps: d.totalReps,
    // Use the goal that applied that day, falling back to the current setting
    // for days recorded before a goal existed.
    goalReps: d.goalReps > 0 ? d.goalReps : settings.dailyGoalReps,
  }));

  const todayRow = allDays.find((d) => d.date === today);
  const { current, best } = computeStreaks(dayRecords, today);

  const [totals] = await db
    .select({
      totalReps: dsql<number>`coalesce(sum(${sessions.reps}), 0)`,
      totalHangMs: dsql<number>`coalesce(sum(${sessions.hangMs}), 0)`,
      sessionCount: dsql<number>`count(*)`,
    })
    .from(sessions);

  return {
    today,
    settings,
    todayReps: todayRow?.totalReps ?? 0,
    todayHangMs: todayRow?.totalHangMs ?? 0,
    dailyGoalReps: settings.dailyGoalReps,
    weeklyReps: weeklyReps(dayRecords, today),
    weeklyGoalReps: settings.weeklyGoalReps,
    currentStreak: current,
    bestStreak: best,
    lifetimeReps: Number(totals?.totalReps ?? 0),
    lifetimeHangMs: Number(totals?.totalHangMs ?? 0),
    lifetimeSessions: Number(totals?.sessionCount ?? 0),
  };
}
