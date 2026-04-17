CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"template_id" text,
	"provider" text,
	"message_id" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"delivery_status" text,
	"bounced_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_brand" ADD COLUMN "email_notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_brand" ADD COLUMN "daily_lead_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_brand" ADD COLUMN "weekly_summary_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_brand" ADD COLUMN "email_notification_hour" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_log_user_idx" ON "email_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_log_message_id_idx" ON "email_log" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "email_log_status_idx" ON "email_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_log_template_idx" ON "email_log" USING btree ("template_id");