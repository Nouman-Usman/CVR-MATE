CREATE TABLE "match_feed_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"company_id" uuid,
	"cvr" text NOT NULL,
	"company_snapshot" jsonb,
	"feed_date" date NOT NULL,
	"rank" integer NOT NULL,
	"score" text NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"cached_filters" jsonb,
	"filters_computed_at" timestamp with time zone,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_feed_item" ADD CONSTRAINT "match_feed_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feed_item" ADD CONSTRAINT "match_feed_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_feed_item" ADD CONSTRAINT "match_feed_item_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_profile" ADD CONSTRAINT "match_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_feed_item_user_cvr_idx" ON "match_feed_item" USING btree ("user_id","cvr");--> statement-breakpoint
CREATE INDEX "match_feed_item_user_date_status_idx" ON "match_feed_item" USING btree ("user_id","feed_date","status");--> statement-breakpoint
CREATE INDEX "match_feed_item_user_status_idx" ON "match_feed_item" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "match_feed_item_org_idx" ON "match_feed_item" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_profile_user_idx" ON "match_profile" USING btree ("user_id");