CREATE TABLE "action_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"key" text NOT NULL,
	"device_id" uuid NOT NULL,
	"action" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_links_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "action_links" ADD CONSTRAINT "action_links_device_id_ir_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."ir_devices"("id") ON DELETE cascade ON UPDATE no action;