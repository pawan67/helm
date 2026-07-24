import { desc, gte, eq, sql as dsql } from "drizzle-orm";
import { db } from "./index";
import { sessions, dailyStats, personalRecords, repEvents } from "./schema";
import { getSettings } from "./persist";
import { computeStreaks, weeklyReps, type DayRecord } from "@/lib/streaks";
import { localDate, addDays } from "@/lib/time";

export async function getRecentSessions(limit = 20) {
  return db.select().from(sessions).orderBy(desc(sessions.startedAt)).limit(limit);
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
