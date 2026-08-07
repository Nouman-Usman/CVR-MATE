CREATE TABLE "organization_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"legal_name" text NOT NULL,
	"cvr" text,
	"address_line" text,
	"zip_code" text,
	"city" text,
	"country_code" text DEFAULT 'DK' NOT NULL,
	"email" text,
	"phone" text,
	"website" text,
	"brand_color" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"cvr_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_profile_source_check" CHECK ("organization_profile"."source" in ('cvr','manual')),
	CONSTRAINT "organization_profile_country_check" CHECK (length("organization_profile"."country_code") = 2)
);
--> statement-breakpoint
ALTER TABLE "organization_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_profile" ADD CONSTRAINT "organization_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_profile_org_idx" ON "organization_profile" USING btree ("organization_id");