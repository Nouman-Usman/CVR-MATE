CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employees" integer,
	"revenue" numeric,
	"profit" numeric,
	"equity" numeric,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'cvr_api' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"status" text DEFAULT 'prospect' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"assigned_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_vat" text NOT NULL,
	"company_name" text NOT NULL,
	"type" text NOT NULL,
	"tone" text NOT NULL,
	"subject" text,
	"message" text NOT NULL,
	"follow_up" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_note" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "company_note" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_connection" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "crm_sync_mapping" ADD COLUMN "sync_direction" text DEFAULT 'push' NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_sync_mapping" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_sync_mapping" ADD COLUMN "last_local_update" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_sync_mapping" ADD COLUMN "last_remote_update" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_trigger" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "lead_trigger" ADD COLUMN "filter_industry_code" text;--> statement-breakpoint
ALTER TABLE "lead_trigger" ADD COLUMN "filter_min_employees" integer;--> statement-breakpoint
ALTER TABLE "lead_trigger" ADD COLUMN "filter_max_employees" integer;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "saved_company" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "saved_company" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saved_search" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_metrics" ADD CONSTRAINT "company_metrics_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_workspace" ADD CONSTRAINT "company_workspace_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_workspace" ADD CONSTRAINT "company_workspace_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_workspace" ADD CONSTRAINT "company_workspace_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_message" ADD CONSTRAINT "outreach_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_user_idx" ON "activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_entity_idx" ON "activity" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_org_idx" ON "activity" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "activity_created_idx" ON "activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_user_type_idx" ON "activity" USING btree ("user_id","entity_type");--> statement-breakpoint
CREATE INDEX "company_metrics_company_idx" ON "company_metrics" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_metrics_recorded_idx" ON "company_metrics" USING btree ("company_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "company_workspace_org_company_idx" ON "company_workspace" USING btree ("organization_id","company_id");--> statement-breakpoint
CREATE INDEX "company_workspace_org_idx" ON "company_workspace" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "company_workspace_status_idx" ON "company_workspace" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "company_workspace_assigned_idx" ON "company_workspace" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "outreach_message_user_idx" ON "outreach_message" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "outreach_message_user_vat_idx" ON "outreach_message" USING btree ("user_id","company_vat");--> statement-breakpoint
CREATE INDEX "outreach_message_created_idx" ON "outreach_message" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "company_note" ADD CONSTRAINT "company_note_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_connection" ADD CONSTRAINT "crm_connection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_trigger" ADD CONSTRAINT "lead_trigger_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_company" ADD CONSTRAINT "saved_company_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_type_idx" ON "company" USING btree ("company_type");--> statement-breakpoint
CREATE INDEX "company_note_org_idx" ON "company_note" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_connection_org_idx" ON "crm_connection" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_sync_mapping_status_idx" ON "crm_sync_mapping" USING btree ("connection_id","sync_status");--> statement-breakpoint
CREATE INDEX "lead_trigger_org_idx" ON "lead_trigger" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "lead_trigger_industry_idx" ON "lead_trigger" USING btree ("filter_industry_code");--> statement-breakpoint
CREATE INDEX "notification_type_idx" ON "notification" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "saved_company_org_idx" ON "saved_company" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saved_search_org_idx" ON "saved_search" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "todo_org_idx" ON "todo" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "todo_priority_idx" ON "todo" USING btree ("user_id","priority");