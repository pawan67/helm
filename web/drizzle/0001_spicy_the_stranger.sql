CREATE TABLE "env_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"temp_c" real,
	"humidity" real
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "sound_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "beep_on_rep" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "beep_on_session_end" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "temp_logging_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "env_readings_at_idx" ON "env_readings" USING btree ("at");