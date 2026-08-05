CREATE TABLE "company_segment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"segment_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"deal_id" uuid,
	"created_by" text,
	"title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date,
	"expiry_date" date,
	"value" bigint,
	"currency" text DEFAULT 'DKK' NOT NULL,
	"renewal_notice_days" integer DEFAULT 30 NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"external_ref" text,
	"notes" text,
	"renewal_notified_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_status_check" CHECK ("contract"."status" in ('draft','active','expired','cancelled','renewed'))
);
--> statement-breakpoint
CREATE TABLE "segment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#94a3b8' NOT NULL,
	"description" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_segment" ADD CONSTRAINT "company_segment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_segment" ADD CONSTRAINT "company_segment_segment_id_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_segment" ADD CONSTRAINT "company_segment_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment" ADD CONSTRAINT "segment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment" ADD CONSTRAINT "segment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_segment_uq" ON "company_segment" USING btree ("segment_id","company_id");--> statement-breakpoint
CREATE INDEX "company_segment_org_idx" ON "company_segment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "company_segment_company_idx" ON "company_segment" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_segment_segment_idx" ON "company_segment" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "contract_org_idx" ON "contract" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_company_idx" ON "contract" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contract_org_expiry_idx" ON "contract" USING btree ("organization_id","expiry_date");--> statement-breakpoint
CREATE INDEX "contract_org_status_idx" ON "contract" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "segment_org_idx" ON "segment" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "segment_org_name_idx" ON "segment" USING btree ("organization_id","name");