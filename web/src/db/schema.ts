import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

/** A session is classified once it ends, based on whether any reps happened. */
export const sessionTypeEnum = pgEnum("session_type", ["pullup_set", "dead_hang"]);

/** The kinds of personal records we track. */
export const recordTypeEnum = pgEnum("record_type", [
  "most_reps_set",
  "most_reps_day",
  "longest_hang",
]);

/**
 * One row per time the user got on the bar (grab -> release).
 * Source of truth for all stats.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: text("device_id").notNull(),
  type: sessionTypeEnum("type").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  reps: integer("reps").notNull().default(0),
  /** Total time on the bar not spent mid-rep (ms). */
  hangMs: integer("hang_ms").notNull().default(0),
  /** Total on-bar time (ms). */
  durationMs: integer("duration_ms").notNull().default(0),
  /** Longest continuous hang within the session (ms) — drives dead-hang PR. */
  maxHangMs: integer("max_hang_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per rep, for tempo detail and rep-timeline charts. */
export const repEvents = pgTable("rep_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  repNumber: integer("rep_number").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(),
  /** How long the concentric (up) phase took (ms). */
  upDurationMs: integer("up_duration_ms").notNull().default(0),
});

/**
 * Per-local-day rollup, rebuildable from sessions. Keeps history / streak /
 * goal queries fast.
 */
export const dailyStats = pgTable("daily_stats", {
  /** Local calendar date (YYYY-MM-DD). */
  date: date("date").primaryKey(),
  totalReps: integer("total_reps").notNull().default(0),
  totalHangMs: integer("total_hang_ms").notNull().default(0),
  sessionsCount: integer("sessions_count").notNull().default(0),
  /** The rep goal that applied on that day (snapshot of settings). */
  goalReps: integer("goal_reps").notNull().default(0),
});

/** Current best for each record type. */
export const personalRecords = pgTable("personal_records", {
  recordType: recordTypeEnum("record_type").primaryKey(),
  value: integer("value").notNull().default(0),
  sessionId: uuid("session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  achievedAt: timestamp("achieved_at", { withTimezone: true }),
});

/** Detection thresholds pushed to the device via retained MQTT config. */
export type DetectionThresholds = {
  presenceMaxMm: number;
  hangBandMm: number;
  repNearMm: number;
  repHysteresisMm: number;
  minRepMs: number;
  releaseMs: number;
  presenceDebounceMs: number;
};

/** Single-row app settings (id is always 1). */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  dailyGoalReps: integer("daily_goal_reps").notNull().default(50),
  weeklyGoalReps: integer("weekly_goal_reps").notNull().default(300),
  dailyGoalHangMs: integer("daily_goal_hang_ms").notNull().default(120000),
  deviceId: text("device_id").notNull().default("bar-01"),
  thresholds: jsonb("thresholds").$type<DetectionThresholds>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type RepEvent = typeof repEvents.$inferSelect;
export type DailyStat = typeof dailyStats.$inferSelect;
export type PersonalRecord = typeof personalRecords.$inferSelect;
export type Settings = typeof settings.$inferSelect;

export const DEFAULT_THRESHOLDS: DetectionThresholds = {
  presenceMaxMm: 900,
  hangBandMm: 600,
  repNearMm: 200,
  repHysteresisMm: 80,
  minRepMs: 400,
  releaseMs: 1500,
  presenceDebounceMs: 300,
};
