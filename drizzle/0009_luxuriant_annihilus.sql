CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"scopes" jsonb DEFAULT '["read"]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rate_limit" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_workspace_id" uuid NOT NULL,
	"assigned_to_user_id" text NOT NULL,
	"assigned_by_user_id" text NOT NULL,
	"note" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_export_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"download_url" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "data_retention_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"activity_retention_days" integer DEFAULT 365 NOT NULL,
	"audit_log_retention_days" integer DEFAULT 730 NOT NULL,
	"deleted_data_retention_days" integer DEFAULT 30 NOT NULL,
	"export_retention_days" integer DEFAULT 90 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_allowlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"cidr" text NOT NULL,
	"description" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mention" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_note_id" uuid NOT NULL,
	"mentioned_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"resource" text NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text,
	"position" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"entity_id" text,
	"sso_url" text,
	"certificate" text,
	"metadata_url" text,
	"enforced" boolean DEFAULT false NOT NULL,
	"allowed_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"lead_user_id" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_delivered_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb,
	"response_status" integer,
	"response_body" text,
	"duration" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "invited_by" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "type" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "max_seats" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "resource" text;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "severity" text DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "company_briefing" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "company_note" ADD COLUMN "visibility" text DEFAULT 'org' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_workspace" ADD COLUMN "pipeline_stage_id" uuid;--> statement-breakpoint
ALTER TABLE "company_workspace" ADD COLUMN "priority" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_workspace" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "company_workspace" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "company_workspace" ADD COLUMN "last_contacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_workspace" ADD COLUMN "next_follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "outreach_message" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "seat_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "seat_price_id" text;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "assigned_to_user_id" text;--> statement-breakpoint
ALTER TABLE "usage_record" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "user_brand" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_assignment" ADD CONSTRAINT "company_assignment_company_workspace_id_company_workspace_id_fk" FOREIGN KEY ("company_workspace_id") REFERENCES "public"."company_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_assignment" ADD CONSTRAINT "company_assignment_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_assignment" ADD CONSTRAINT "company_assignment_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_retention_policy" ADD CONSTRAINT "data_retention_policy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_allowlist" ADD CONSTRAINT "ip_allowlist_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_allowlist" ADD CONSTRAINT "ip_allowlist_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention" ADD CONSTRAINT "mention_company_note_id_company_note_id_fk" FOREIGN KEY ("company_note_id") REFERENCES "public"."company_note"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention" ADD CONSTRAINT "mention_mentioned_user_id_user_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_permission" ADD CONSTRAINT "org_permission_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_config" ADD CONSTRAINT "sso_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_lead_user_id_user_id_fk" FOREIGN KEY ("lead_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_webhook_id_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_org_idx" ON "api_key" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_hash_idx" ON "api_key" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_key_prefix_idx" ON "api_key" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "company_assignment_workspace_idx" ON "company_assignment" USING btree ("company_workspace_id");--> statement-breakpoint
CREATE INDEX "company_assignment_assigned_to_idx" ON "company_assignment" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "data_export_request_org_idx" ON "data_export_request" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "data_export_request_status_idx" ON "data_export_request" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "data_retention_policy_org_idx" ON "data_retention_policy" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ip_allowlist_org_idx" ON "ip_allowlist" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mention_note_idx" ON "mention" USING btree ("company_note_id");--> statement-breakpoint
CREATE INDEX "mention_user_idx" ON "mention" USING btree ("mentioned_user_id");--> statement-breakpoint
CREATE INDEX "org_permission_org_idx" ON "org_permission" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_permission_org_role_resource_idx" ON "org_permission" USING btree ("organization_id","role","resource");--> statement-breakpoint
CREATE INDEX "pipeline_stage_org_idx" ON "pipeline_stage" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stage_org_slug_idx" ON "pipeline_stage" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "pipeline_stage_position_idx" ON "pipeline_stage" USING btree ("organization_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "sso_config_org_idx" ON "sso_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "team_org_idx" ON "team" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_org_name_idx" ON "team" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "team_member_team_idx" ON "team_member" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_member_user_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_member_team_user_idx" ON "team_member" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "webhook_org_idx" ON "webhook" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "webhook_active_idx" ON "webhook" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "webhook_delivery_webhook_idx" ON "webhook_delivery" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_delivery_created_idx" ON "webhook_delivery" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_delivery_status_idx" ON "webhook_delivery" USING btree ("webhook_id","status");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_briefing" ADD CONSTRAINT "company_briefing_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_message" ADD CONSTRAINT "outreach_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_record" ADD CONSTRAINT "usage_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_brand" ADD CONSTRAINT "user_brand_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_team_idx" ON "member" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_idx" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_owner_idx" ON "organization" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "organization_type_idx" ON "organization" USING btree ("type");--> statement-breakpoint
CREATE INDEX "company_briefing_org_idx" ON "company_briefing" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notification_org_idx" ON "notification" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "outreach_message_org_idx" ON "outreach_message" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_org_idx" ON "subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "usage_record_org_feature_created_idx" ON "usage_record" USING btree ("organization_id","feature","created_at");--> statement-breakpoint
CREATE INDEX "user_brand_org_idx" ON "user_brand" USING btree ("organization_id");