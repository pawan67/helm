import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { schedules, type Schedule } from "./schema";
import type { ScheduleAction } from "@/lib/schedule";

export type ScheduleInput = {
  name?: string;
  deviceId: string;
  action: ScheduleAction;
  atMinute: number;
  days: number[];
  enabled?: boolean;
};

/** All schedules, ordered by time then creation — the list the UI renders. */
export async function listSchedules(): Promise<Schedule[]> {
  return db
    .select()
    .from(schedules)
    .orderBy(asc(schedules.atMinute), asc(schedules.createdAt));
}

/** Enabled schedules whose fire time matches `atMinute` (weekday filtered in JS). */
export async function getDueSchedules(atMinute: number): Promise<Schedule[]> {
  return db
    .select()
    .from(schedules)
    .where(and(eq(schedules.enabled, true), eq(schedules.atMinute, atMinute)));
}

export async function createSchedule(input: ScheduleInput): Promise<Schedule> {
  const [row] = await db
    .insert(schedules)
    .values({
      name: input.name ?? "",
      deviceId: input.deviceId,
      action: input.action,
      atMinute: input.atMinute,
      days: input.days,
      enabled: input.enabled ?? true,
    })
    .returning();
  return row;
}

export async function updateSchedule(
  id: string,
  patch: Partial<ScheduleInput>,
): Promise<Schedule | null> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.deviceId !== undefined) set.deviceId = patch.deviceId;
  if (patch.action !== undefined) set.action = patch.action;
  if (patch.atMinute !== undefined) set.atMinute = patch.atMinute;
  if (patch.days !== undefined) set.days = patch.days;
  if (patch.enabled !== undefined) set.enabled = patch.enabled;
  if (Object.keys(set).length === 0) {
    const [row] = await db.select().from(schedules).where(eq(schedules.id, id));
    return row ?? null;
  }
  const [row] = await db
    .update(schedules)
    .set(set)
    .where(eq(schedules.id, id))
    .returning();
  return row ?? null;
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const rows = await db
    .delete(schedules)
    .where(eq(schedules.id, id))
    .returning({ id: schedules.id });
  return rows.length > 0;
}

/** Stamp when a schedule last fired (dedupe guard for the scheduler). */
export async function markScheduleRan(id: string, at: Date): Promise<void> {
  await db.update(schedules).set({ lastRunAt: at }).where(eq(schedules.id, id));
}
