import { eq, and, gte, lt, sql as dsql } from "drizzle-orm";
import { db } from "./index";
import {
  sessions,
  repEvents,
  envReadings,
  dailyStats,
  personalRecords,
  settings,
  DEFAULT_THRESHOLDS,
  type DetectionThresholds,
} from "./schema";
import { localDate, addDays } from "@/lib/time";
import { env } from "@/lib/env";

/** Shape of the end-of-session summary the device publishes. */
export type SessionSummary = {
  sessionId?: string;
  deviceId: string;
  startedAt: string; // ISO
  endedAt: string; // ISO
  reps: number;
  hangMs: number;
  durationMs: number;
  maxHangMs: number;
  repTimings?: { repNumber: number; at: string; upDurationMs: number }[];
};

/**
 * Persist a completed session: insert the session row + rep events, update the
 * per-day rollup, and refresh personal records. Returns the stored session id
 * and any records that were beaten (so the live screen can celebrate).
 */
export async function persistSession(summary: SessionSummary): Promise<{
  sessionId: string;
  brokenRecords: string[];
}> {
  const type = summary.reps > 0 ? "pullup_set" : "dead_hang";
  const startedAt = new Date(summary.startedAt);
  const endedAt = new Date(summary.endedAt);
  const day = localDate(endedAt);

  const [inserted] = await db
    .insert(sessions)
    .values({
      deviceId: summary.deviceId,
      type,
      startedAt,
      endedAt,
      reps: summary.reps,
      hangMs: summary.hangMs,
      durationMs: summary.durationMs,
      maxHangMs: summary.maxHangMs,
    })
    .returning({ id: sessions.id });

  const sessionId = inserted.id;

  if (summary.repTimings && summary.repTimings.length > 0) {
    await db.insert(repEvents).values(
      summary.repTimings.map((r) => ({
        sessionId,
        repNumber: r.repNumber,
        at: new Date(r.at),
        upDurationMs: r.upDurationMs,
      })),
    );
  }

  const goalReps = await currentDailyGoal();

  // Upsert the daily rollup.
  await db
    .insert(dailyStats)
    .values({
      date: day,
      totalReps: summary.reps,
      totalHangMs: summary.hangMs,
      sessionsCount: 1,
      goalReps,
    })
    .onConflictDoUpdate({
      target: dailyStats.date,
      set: {
        totalReps: dsql`${dailyStats.totalReps} + ${summary.reps}`,
        totalHangMs: dsql`${dailyStats.totalHangMs} + ${summary.hangMs}`,
        sessionsCount: dsql`${dailyStats.sessionsCount} + 1`,
        goalReps,
      },
    });

  const dayTotalReps = await dayRepTotal(day);
  const brokenRecords = await updateRecords({
    sessionId,
    endedAt,
    reps: summary.reps,
    maxHangMs: summary.maxHangMs,
    dayTotalReps,
  });

  return { sessionId, brokenRecords };
}

/** Insert one ambient reading from the on-bar DHT11. */
export async function persistEnvReading(reading: {
  deviceId: string;
  at: Date;
  tempC: number | null;
  humidity: number | null;
}): Promise<void> {
  await db.insert(envReadings).values({
    deviceId: reading.deviceId,
    at: reading.at,
    tempC: reading.tempC,
    humidity: reading.humidity,
  });
}

async function dayRepTotal(day: string): Promise<number> {
  const [row] = await db
    .select({ total: dailyStats.totalReps })
    .from(dailyStats)
    .where(eq(dailyStats.date, day));
  return row?.total ?? 0;
}

/** Read the current daily rep goal (falls back to a default). */
export async function currentDailyGoal(): Promise<number> {
  const s = await getSettings();
  return s.dailyGoalReps;
}

/**
 * Update personal records if this session beat any. Returns the list of record
 * types that were broken.
 */
async function updateRecords(input: {
  sessionId: string;
  endedAt: Date;
  reps: number;
  maxHangMs: number;
  dayTotalReps: number;
}): Promise<string[]> {
  const broken: string[] = [];

  const candidates: {
    recordType: "most_reps_set" | "most_reps_day" | "longest_hang";
    value: number;
  }[] = [
    { recordType: "most_reps_set", value: input.reps },
    { recordType: "most_reps_day", value: input.dayTotalReps },
    { recordType: "longest_hang", value: input.maxHangMs },
  ];

  const existing = await db.select().from(personalRecords);
  const byType = new Map(existing.map((r) => [r.recordType, r]));

  for (const c of candidates) {
    if (c.value <= 0) continue;
    const prev = byType.get(c.recordType);
    if (!prev || c.value > prev.value) {
      broken.push(c.recordType);
      await db
        .insert(personalRecords)
        .values({
          recordType: c.recordType,
          value: c.value,
          sessionId: input.sessionId,
          achievedAt: input.endedAt,
        })
        .onConflictDoUpdate({
          target: personalRecords.recordType,
          set: {
            value: c.value,
            sessionId: input.sessionId,
            achievedAt: input.endedAt,
          },
        });
    }
  }

  return broken;
}

// ---------------------------------------------------------------------------
//  Manual session CRUD
//
//  Sessions are the source of truth; daily_stats and personal_records are
//  derived. Any manual create/update/delete therefore recomputes the affected
//  day rollup(s) and rebuilds personal records so nothing drifts out of sync.
// ---------------------------------------------------------------------------

const sessionType = (reps: number): "pullup_set" | "dead_hang" =>
  reps > 0 ? "pullup_set" : "dead_hang";

/** Rebuild one local day's rollup from the sessions that ended that day. */
export async function recomputeDailyStats(day: string): Promise<void> {
  // Query a wide UTC window (any timezone offset fits within ±1 day), then
  // filter to the exact local day — avoids fragile local-midnight→UTC math.
  const rows = await db
    .select()
    .from(sessions)
    .where(
      and(
        gte(sessions.endedAt, new Date(addDays(day, -1))),
        lt(sessions.endedAt, new Date(addDays(day, 2))),
      ),
    );
  const members = rows.filter((s) => localDate(new Date(s.endedAt)) === day);

  if (members.length === 0) {
    await db.delete(dailyStats).where(eq(dailyStats.date, day));
    return;
  }

  const totalReps = members.reduce((a, s) => a + s.reps, 0);
  const totalHangMs = members.reduce((a, s) => a + s.hangMs, 0);
  const [existing] = await db
    .select({ goalReps: dailyStats.goalReps })
    .from(dailyStats)
    .where(eq(dailyStats.date, day));
  const goalReps = existing?.goalReps ?? (await currentDailyGoal());

  await db
    .insert(dailyStats)
    .values({ date: day, totalReps, totalHangMs, sessionsCount: members.length, goalReps })
    .onConflictDoUpdate({
      target: dailyStats.date,
      set: { totalReps, totalHangMs, sessionsCount: members.length, goalReps },
    });
}

/** Rebuild personal_records from scratch off every stored session. */
export async function recomputePersonalRecords(): Promise<void> {
  const all = await db.select().from(sessions);

  let bestSet: (typeof all)[number] | null = null;
  let bestHang: (typeof all)[number] | null = null;
  const dayTotals = new Map<string, { reps: number; endedAt: Date }>();

  for (const s of all) {
    if (s.reps > 0 && (!bestSet || s.reps > bestSet.reps)) bestSet = s;
    if (s.maxHangMs > 0 && (!bestHang || s.maxHangMs > bestHang.maxHangMs)) bestHang = s;
    const endedAt = new Date(s.endedAt);
    const day = localDate(endedAt);
    const cur = dayTotals.get(day);
    if (!cur) dayTotals.set(day, { reps: s.reps, endedAt });
    else
      dayTotals.set(day, {
        reps: cur.reps + s.reps,
        endedAt: endedAt > cur.endedAt ? endedAt : cur.endedAt,
      });
  }

  let bestDay: { reps: number; endedAt: Date } | null = null;
  for (const v of dayTotals.values()) {
    if (v.reps > 0 && (!bestDay || v.reps > bestDay.reps)) bestDay = v;
  }

  const inserts: (typeof personalRecords.$inferInsert)[] = [];
  if (bestSet)
    inserts.push({
      recordType: "most_reps_set",
      value: bestSet.reps,
      sessionId: bestSet.id,
      achievedAt: new Date(bestSet.endedAt),
    });
  if (bestDay)
    inserts.push({
      recordType: "most_reps_day",
      value: bestDay.reps,
      sessionId: null,
      achievedAt: bestDay.endedAt,
    });
  if (bestHang)
    inserts.push({
      recordType: "longest_hang",
      value: bestHang.maxHangMs,
      sessionId: bestHang.id,
      achievedAt: new Date(bestHang.endedAt),
    });

  await db.delete(personalRecords);
  if (inserts.length > 0) await db.insert(personalRecords).values(inserts);
}

/** Editable fields of a session (device sets these automatically on capture). */
export type SessionInput = {
  startedAt: string; // ISO
  durationMs: number;
  reps: number;
  hangMs: number;
  maxHangMs: number;
};

/** Edit an existing session; recomputes both the old and new day if it moved. */
export async function updateSession(id: string, patch: Partial<SessionInput>) {
  const [existing] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!existing) return null;

  const startedAt = patch.startedAt ? new Date(patch.startedAt) : new Date(existing.startedAt);
  const durationMs = patch.durationMs ?? existing.durationMs;
  const endedAt = new Date(startedAt.getTime() + durationMs);
  const reps = patch.reps ?? existing.reps;
  const hangMs = patch.hangMs ?? existing.hangMs;
  const maxHangMs = patch.maxHangMs ?? existing.maxHangMs;

  const [row] = await db
    .update(sessions)
    .set({ startedAt, endedAt, durationMs, reps, hangMs, maxHangMs, type: sessionType(reps) })
    .where(eq(sessions.id, id))
    .returning();

  const oldDay = localDate(new Date(existing.endedAt));
  const newDay = localDate(endedAt);
  await recomputeDailyStats(newDay);
  if (newDay !== oldDay) await recomputeDailyStats(oldDay);
  await recomputePersonalRecords();
  return row;
}

/** Delete a session (rep_events cascade), then refresh rollups/records. */
export async function deleteSession(id: string): Promise<boolean> {
  const [existing] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!existing) return false;

  await db.delete(sessions).where(eq(sessions.id, id));
  await recomputeDailyStats(localDate(new Date(existing.endedAt)));
  await recomputePersonalRecords();
  return true;
}

/** Fetch settings, creating the default row on first access. */
export async function getSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (row) return row;
  const [created] = await db
    .insert(settings)
    .values({
      id: 1,
      deviceId: env.deviceId,
      thresholds: DEFAULT_THRESHOLDS,
    })
    .returning();
  return created;
}

export async function updateSettings(patch: {
  dailyGoalReps?: number;
  weeklyGoalReps?: number;
  dailyGoalHangMs?: number;
  thresholds?: DetectionThresholds;
  soundEnabled?: boolean;
  beepOnRep?: boolean;
  beepOnSessionEnd?: boolean;
  tempLoggingEnabled?: boolean;
}) {
  await getSettings(); // ensure row exists
  const [row] = await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning();
  return row;
}
