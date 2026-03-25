CREATE TABLE "company_briefing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_vat" text NOT NULL,
	"company_name" text NOT NULL,
	"briefing" text NOT NULL,
	"key_insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_approach" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_briefing" ADD CONSTRAINT "company_briefing_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_briefing_user_idx" ON "company_briefing" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "company_briefing_user_vat_idx" ON "company_briefing" USING btree ("user_id","company_vat");--> statement-breakpoint
CREATE INDEX "company_briefing_created_idx" ON "company_briefing" USING btree ("created_at");