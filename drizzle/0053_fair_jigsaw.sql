CREATE TABLE "accounting_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"connected_by" text,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"agreement_name" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_connection_provider_check" CHECK ("accounting_connection"."provider" in ('economic','dinero','billy'))
);
--> statement-breakpoint
ALTER TABLE "accounting_connection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accounting_customer_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"external_customer_id" text NOT NULL,
	"matched_by" text DEFAULT 'cvr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_customer_map_matched_check" CHECK ("accounting_customer_map"."matched_by" in ('cvr','name','created'))
);
--> statement-breakpoint
ALTER TABLE "accounting_customer_map" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"connection_id" uuid,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"invoice_number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" date,
	"due_date" date,
	"currency" text DEFAULT 'DKK' NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"vat_total" bigint DEFAULT 0 NOT NULL,
	"totals_mismatch" boolean DEFAULT false NOT NULL,
	"pdf_url" text,
	"last_synced_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_invoice_status_check" CHECK ("order_invoice"."status" in ('draft','booked','sent','paid','overdue','credited','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "order_invoice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_profile" ADD COLUMN "default_payment_terms_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_connection" ADD CONSTRAINT "accounting_connection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_connection" ADD CONSTRAINT "accounting_connection_connected_by_user_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_customer_map" ADD CONSTRAINT "accounting_customer_map_connection_id_accounting_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."accounting_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_customer_map" ADD CONSTRAINT "accounting_customer_map_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_invoice" ADD CONSTRAINT "order_invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_invoice" ADD CONSTRAINT "order_invoice_order_id_sales_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_invoice" ADD CONSTRAINT "order_invoice_connection_id_accounting_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."accounting_connection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_invoice" ADD CONSTRAINT "order_invoice_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounting_connection_org_idx" ON "accounting_connection" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_connection_active_uq" ON "accounting_connection" USING btree ("organization_id","provider") WHERE "accounting_connection"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_customer_map_uq" ON "accounting_customer_map" USING btree ("connection_id","company_id");--> statement-breakpoint
CREATE INDEX "accounting_customer_map_external_idx" ON "accounting_customer_map" USING btree ("connection_id","external_customer_id");--> statement-breakpoint
CREATE INDEX "order_invoice_org_idx" ON "order_invoice" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "order_invoice_order_idx" ON "order_invoice" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_invoice_status_idx" ON "order_invoice" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "order_invoice_live_uq" ON "order_invoice" USING btree ("order_id") WHERE "order_invoice"."status" <> 'cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX "order_invoice_external_uq" ON "order_invoice" USING btree ("provider","external_id");