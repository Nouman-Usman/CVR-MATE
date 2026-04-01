CREATE TABLE "profile_enrichment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_name" text NOT NULL,
	"enrichment_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_enrichment" ADD CONSTRAINT "profile_enrichment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_enrichment_user_idx" ON "profile_enrichment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profile_enrichment_entity_idx" ON "profile_enrichment" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "profile_enrichment_created_idx" ON "profile_enrichment" USING btree ("created_at");