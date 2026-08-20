CREATE TABLE "annual_report_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cvr" text NOT NULL,
	"company_name" text,
	"period_end" date NOT NULL,
	"period_start" date,
	"source" text DEFAULT 'cvr_api' NOT NULL,
	"publicdate" date,
	"document_url" text,
	"summary_json" jsonb,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annual_report_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "followed_company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"cvr" text NOT NULL,
	"company_name" text NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "followed_company" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_metrics" ADD COLUMN "period_end" date;--> statement-breakpoint
ALTER TABLE "followed_company" ADD CONSTRAINT "followed_company_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_company" ADD CONSTRAINT "followed_company_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "annual_report_event_identity_uq" ON "annual_report_event" USING btree ("cvr","period_end","source");--> statement-breakpoint
CREATE INDEX "annual_report_event_cvr_idx" ON "annual_report_event" USING btree ("cvr","period_end");--> statement-breakpoint
CREATE INDEX "annual_report_event_seen_idx" ON "annual_report_event" USING btree ("first_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "followed_company_user_cvr_idx" ON "followed_company" USING btree ("user_id","cvr");--> statement-breakpoint
CREATE INDEX "followed_company_user_idx" ON "followed_company" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "followed_company_cvr_idx" ON "followed_company" USING btree ("cvr");--> statement-breakpoint
CREATE INDEX "followed_company_org_idx" ON "followed_company" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "followed_company_active_idx" ON "followed_company" USING btree ("is_active","cvr");--> statement-breakpoint
CREATE UNIQUE INDEX "company_metrics_period_uq" ON "company_metrics" USING btree ("company_id","period_end","source");