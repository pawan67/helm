CREATE TABLE "firmware_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"md5" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "firmware_uploads_uploaded_idx" ON "firmware_uploads" USING btree ("uploaded_at");