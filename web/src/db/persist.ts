import { eq, sql as dsql } from "drizzle-orm";
import { db } from "./index";
import {
  sessions,
  repEvents,
  dailyStats,
  personalRecords,
  settings,
  DEFAULT_THRESHOLDS,
  type DetectionThresholds,
} from "./schema";
import { localDate } from "@/lib/time";
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
}) {
  await getSettings(); // ensure row exists
  const [row] = await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning();
  return row;
}
