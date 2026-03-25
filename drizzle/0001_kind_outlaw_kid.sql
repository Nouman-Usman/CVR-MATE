CREATE TABLE "user_brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"cvr" text,
	"industry" text,
	"industry_code" text,
	"company_size" text,
	"employees" integer,
	"website" text,
	"products" text NOT NULL,
	"target_audience" text,
	"tone" text DEFAULT 'formal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_brand" ADD CONSTRAINT "user_brand_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_brand_user_idx" ON "user_brand" USING btree ("user_id");