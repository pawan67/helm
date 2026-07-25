CREATE TYPE "public"."ir_device_kind" AS ENUM('climate', 'generic');--> statement-breakpoint
CREATE TABLE "ir_buttons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"label" text NOT NULL,
	"icon" text DEFAULT 'dot' NOT NULL,
	"protocol" text DEFAULT 'NEC' NOT NULL,
	"code" text NOT NULL,
	"bits" integer DEFAULT 32 NOT NULL,
	"repeats" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ir_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "ir_device_kind" NOT NULL,
	"icon" text DEFAULT 'tv' NOT NULL,
	"protocol" text DEFAULT '' NOT NULL,
	"config" jsonb,
	"state" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ir_buttons" ADD CONSTRAINT "ir_buttons_device_id_ir_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."ir_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ir_buttons_device_idx" ON "ir_buttons" USING btree ("device_id");