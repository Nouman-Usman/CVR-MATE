CREATE TABLE "crm_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"instance_url" text,
	"scopes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"local_entity_type" text,
	"local_entity_id" uuid,
	"crm_entity_id" text,
	"status" text NOT NULL,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sync_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"local_entity_type" text NOT NULL,
	"local_entity_id" uuid NOT NULL,
	"crm_entity_type" text NOT NULL,
	"crm_entity_id" text NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_status" text DEFAULT 'synced' NOT NULL,
	"sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_connection" ADD CONSTRAINT "crm_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_log" ADD CONSTRAINT "crm_sync_log_connection_id_crm_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."crm_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_log" ADD CONSTRAINT "crm_sync_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_mapping" ADD CONSTRAINT "crm_sync_mapping_connection_id_crm_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."crm_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_connection_user_provider_idx" ON "crm_connection" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "crm_connection_user_idx" ON "crm_connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "crm_sync_log_connection_idx" ON "crm_sync_log" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "crm_sync_log_user_idx" ON "crm_sync_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "crm_sync_log_created_idx" ON "crm_sync_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_sync_mapping_unique_idx" ON "crm_sync_mapping" USING btree ("connection_id","local_entity_type","local_entity_id");--> statement-breakpoint
CREATE INDEX "crm_sync_mapping_connection_idx" ON "crm_sync_mapping" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "crm_sync_mapping_local_idx" ON "crm_sync_mapping" USING btree ("local_entity_type","local_entity_id");