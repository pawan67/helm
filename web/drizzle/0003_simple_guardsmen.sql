CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"device_id" uuid NOT NULL,
	"action" jsonb NOT NULL,
	"at_minute" integer NOT NULL,
	"days" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_device_id_ir_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."ir_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedules_enabled_idx" ON "schedules" USING btree ("enabled","at_minute");