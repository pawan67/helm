/**
 * Minute-resolution schedule runner. Booted once from instrumentation.ts,
 * alongside the MQTT bridge. Every minute it finds enabled schedules whose
 * local fire-time matches now, filters by weekday, and runs each action through
 * the SAME command path the remote UI uses (applyClimateAndBroadcast /
 * fireIrButton) — so IR fires and Home Assistant state stay consistent.
 *
 * `lastRunAt` guards against a double-fire if two ticks land in the same minute.
 */
import { getDueSchedules, markScheduleRan } from "@/db/schedules";
import type { Schedule } from "@/db/schema";
import { applyClimateAndBroadcast, fireIrButton } from "./mqtt";
import { localClock } from "./time";
import { env } from "./env";

const globalForScheduler = globalThis as unknown as {
  __helmSchedulerOn?: boolean;
  __helmSchedulerTimer?: ReturnType<typeof setTimeout>;
};

export function startScheduler(): void {
  if (globalForScheduler.__helmSchedulerOn) return;
  globalForScheduler.__helmSchedulerOn = true;

  // Align the first tick to just after the next minute boundary, then run
  // once a minute. The small offset avoids racing the :00 second.
  const msToNextMinute = (60 - new Date().getSeconds()) * 1000 + 250;
  const loop = () => {
    void runDueSchedules();
    globalForScheduler.__helmSchedulerTimer = setTimeout(loop, 60_000);
  };
  globalForScheduler.__helmSchedulerTimer = setTimeout(loop, msToNextMinute);
  console.log("[scheduler] started");
}

/**
 * Evaluate all schedules against `now` and fire the due ones. Exported so it can
 * be exercised directly (tests / verification); the timer in startScheduler just
 * calls it once a minute. Returns the ids of the schedules it fired.
 */
export async function runDueSchedules(now: Date = new Date()): Promise<string[]> {
  const { minute, weekday } = localClock(now, env.timezone);
  if (weekday < 0) return [];

  let due: Schedule[];
  try {
    due = await getDueSchedules(minute);
  } catch (err) {
    console.error("[scheduler] query failed:", err);
    return [];
  }

  const fired: string[] = [];
  for (const s of due) {
    // Weekday filter (empty days = every day).
    if (s.days.length > 0 && !s.days.includes(weekday)) continue;
    // Dedupe: skip if we already fired within the last ~1.5 min.
    if (s.lastRunAt && now.getTime() - new Date(s.lastRunAt).getTime() < 90_000) {
      continue;
    }
    try {
      await runAction(s);
      await markScheduleRan(s.id, now);
      fired.push(s.id);
      console.log(`[scheduler] fired ${s.id} (${s.name || "schedule"})`);
    } catch (err) {
      console.error(`[scheduler] action failed for ${s.id}:`, err);
    }
  }
  return fired;
}

async function runAction(s: Schedule): Promise<void> {
  const action = s.action;
  if (action.kind === "climate") {
    await applyClimateAndBroadcast(s.deviceId, action.patch);
  } else if (action.kind === "button") {
    await fireIrButton(action.buttonId);
  }
}
