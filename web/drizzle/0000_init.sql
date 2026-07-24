CREATE TYPE "public"."record_type" AS ENUM('most_reps_set', 'most_reps_day', 'longest_hang');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('pullup_set', 'dead_hang');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_stats" (
	"date" date PRIMARY KEY NOT NULL,
	"total_reps" integer DEFAULT 0 NOT NULL,
	"total_hang_ms" integer DEFAULT 0 NOT NULL,
	"sessions_count" integer DEFAULT 0 NOT NULL,
	"goal_reps" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "personal_records" (
	"record_type" "record_type" PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"session_id" uuid,
	"achieved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rep_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"rep_number" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"up_duration_ms" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"type" "session_type" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"hang_ms" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"max_hang_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"daily_goal_reps" integer DEFAULT 50 NOT NULL,
	"weekly_goal_reps" integer DEFAULT 300 NOT NULL,
	"daily_goal_hang_ms" integer DEFAULT 120000 NOT NULL,
	"device_id" text DEFAULT 'bar-01' NOT NULL,
	"thresholds" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rep_events" ADD CONSTRAINT "rep_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
