CREATE TABLE "change_feed_cursor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_type" text NOT NULL,
	"last_change_id" text NOT NULL,
	"is_processing" boolean DEFAULT false NOT NULL,
	"processing_started_at" timestamp with time zone,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followed_person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"participant_number" text NOT NULL,
	"person_name" text NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_company_index" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_number" text NOT NULL,
	"company_vat" text NOT NULL,
	"company_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_role_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_number" text NOT NULL,
	"company_vat" text NOT NULL,
	"company_name" text,
	"person_name" text,
	"event_type" text NOT NULL,
	"event_category" text NOT NULL,
	"role" jsonb,
	"previous_value" jsonb,
	"new_value" jsonb,
	"importance" text DEFAULT 'normal' NOT NULL,
	"event_hash" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_role_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_number" text NOT NULL,
	"company_vat" text NOT NULL,
	"roles_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"company_name" text,
	"company_status" text,
	"company_bankrupt" boolean DEFAULT false,
	"company_industry" text,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "followed_person" ADD CONSTRAINT "followed_person_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_person" ADD CONSTRAINT "followed_person_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "change_feed_cursor_type_idx" ON "change_feed_cursor" USING btree ("feed_type");--> statement-breakpoint
CREATE UNIQUE INDEX "followed_person_user_participant_idx" ON "followed_person" USING btree ("user_id","participant_number");--> statement-breakpoint
CREATE INDEX "followed_person_user_idx" ON "followed_person" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "followed_person_participant_idx" ON "followed_person" USING btree ("participant_number");--> statement-breakpoint
CREATE INDEX "followed_person_org_idx" ON "followed_person" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_company_idx" ON "person_company_index" USING btree ("participant_number","company_vat");--> statement-breakpoint
CREATE INDEX "person_company_participant_idx" ON "person_company_index" USING btree ("participant_number");--> statement-breakpoint
CREATE INDEX "person_company_vat_idx" ON "person_company_index" USING btree ("company_vat");--> statement-breakpoint
CREATE UNIQUE INDEX "person_role_event_hash_idx" ON "person_role_event" USING btree ("event_hash");--> statement-breakpoint
CREATE INDEX "person_role_event_participant_idx" ON "person_role_event" USING btree ("participant_number");--> statement-breakpoint
CREATE INDEX "person_role_event_company_idx" ON "person_role_event" USING btree ("company_vat");--> statement-breakpoint
CREATE INDEX "person_role_event_detected_idx" ON "person_role_event" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "person_role_event_type_idx" ON "person_role_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "person_role_event_category_idx" ON "person_role_event" USING btree ("event_category");--> statement-breakpoint
CREATE UNIQUE INDEX "person_role_snapshot_unique_idx" ON "person_role_snapshot" USING btree ("participant_number","company_vat");--> statement-breakpoint
CREATE INDEX "person_role_snapshot_participant_idx" ON "person_role_snapshot" USING btree ("participant_number");