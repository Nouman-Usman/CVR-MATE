CREATE TABLE "chat_landing_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qualifying_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommended_plan" text,
	"preview_company_vats" jsonb DEFAULT '[]'::jsonb,
	"preview_company_snapshot" jsonb,
	"signup_user_id" text,
	"signup_email" text,
	"converted_at" timestamp with time zone,
	"slack_notified_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "trial_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "trial_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_landing_session" ADD CONSTRAINT "chat_landing_session_signup_user_id_user_id_fk" FOREIGN KEY ("signup_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_landing_session_signup_user_idx" ON "chat_landing_session" USING btree ("signup_user_id");--> statement-breakpoint
CREATE INDEX "chat_landing_session_created_idx" ON "chat_landing_session" USING btree ("created_at");