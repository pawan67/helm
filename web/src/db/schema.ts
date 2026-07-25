import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { IrClimateConfig, IrClimateState } from "../lib/ir-climate";

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
 * Ambient temperature/humidity samples from the on-bar DHT11. One row per
 * publish (~1/min). Raw and rebuildable-free — the Environment view aggregates
 * these into hourly/daily buckets at query time (no separate rollup table).
 */
export const envReadings = pgTable(
  "env_readings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: text("device_id").notNull(),
    /** Server receive time (the ESP32 has no reliable wall clock). */
    at: timestamp("at", { withTimezone: true }).notNull(),
    /** Degrees Celsius. Nullable so a failed sensor read can be recorded as a gap. */
    tempC: real("temp_c"),
    /** Relative humidity (%). */
    humidity: real("humidity"),
  },
  (t) => [index("env_readings_at_idx").on(t.at)],
);

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

/** Buzzer behaviour, pushed to the device via retained MQTT config. */
export type SoundSettings = {
  soundEnabled: boolean;
  beepOnRep: boolean;
  beepOnSessionEnd: boolean;
};

/** Single-row app settings (id is always 1). */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  dailyGoalReps: integer("daily_goal_reps").notNull().default(50),
  weeklyGoalReps: integer("weekly_goal_reps").notNull().default(300),
  dailyGoalHangMs: integer("daily_goal_hang_ms").notNull().default(120000),
  deviceId: text("device_id").notNull().default("bar-01"),
  thresholds: jsonb("thresholds").$type<DetectionThresholds>().notNull(),
  /** Master buzzer switch — off silences all beeps regardless of the flags below. */
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  /** Chirp on each counted rep. */
  beepOnRep: boolean("beep_on_rep").notNull().default(true),
  /** Two-tone jingle when a set is saved. */
  beepOnSessionEnd: boolean("beep_on_session_end").notNull().default(true),
  /** When off, live temperature still shows but nothing is written to env_readings. */
  tempLoggingEnabled: boolean("temp_logging_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
//  IR remote (infrared blaster on the bar node)
// ---------------------------------------------------------------------------

/** A climate device holds optimistic state; a generic device is a set of buttons. */
export const irDeviceKindEnum = pgEnum("ir_device_kind", ["climate", "generic"]);

/**
 * An IR-controllable device. `config`/`state` are only populated for climate
 * devices; generic devices carry their commands in `ir_buttons`.
 */
export const irDevices = pgTable("ir_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: irDeviceKindEnum("kind").notNull(),
  /** lucide-react icon key rendered in the console (e.g. "air-vent", "fan"). */
  icon: text("icon").notNull().default("tv"),
  /** Protocol family: "PANASONIC_AC" for climate, "" for generic (per-button). */
  protocol: text("protocol").notNull().default(""),
  /** Climate capabilities (model, temp range, modes, fans). Null for generic. */
  config: jsonb("config").$type<IrClimateConfig | null>(),
  /** Optimistic, last-commanded climate state. Null for generic. */
  state: jsonb("state").$type<IrClimateState | null>(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One IR command (a labelled button) belonging to a generic device. */
export const irButtons = pgTable(
  "ir_buttons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => irDevices.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    icon: text("icon").notNull().default("dot"),
    /** IRremoteESP8266 protocol name, e.g. "NEC", "SAMSUNG". */
    protocol: text("protocol").notNull().default("NEC"),
    /** Hex code (no 0x), parsed on-device with strtoull(code, 16). */
    code: text("code").notNull(),
    bits: integer("bits").notNull().default(32),
    /** Extra send repeats (0 = send once). */
    repeats: integer("repeats").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("ir_buttons_device_idx").on(t.deviceId)],
);

export type IrDevice = typeof irDevices.$inferSelect;
export type NewIrDevice = typeof irDevices.$inferInsert;
export type IrButton = typeof irButtons.$inferSelect;
export type NewIrButton = typeof irButtons.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type RepEvent = typeof repEvents.$inferSelect;
export type EnvReading = typeof envReadings.$inferSelect;
export type NewEnvReading = typeof envReadings.$inferInsert;
export type DailyStat = typeof dailyStats.$inferSelect;
export type PersonalRecord = typeof personalRecords.$inferSelect;
export type Settings = typeof settings.$inferSelect;

export const DEFAULT_SOUND: SoundSettings = {
  soundEnabled: true,
  beepOnRep: true,
  beepOnSessionEnd: true,
};

export const DEFAULT_THRESHOLDS: DetectionThresholds = {
  presenceMaxMm: 900,
  hangBandMm: 600,
  repNearMm: 200,
  repHysteresisMm: 80,
  minRepMs: 400,
  releaseMs: 1500,
  presenceDebounceMs: 300,
};
