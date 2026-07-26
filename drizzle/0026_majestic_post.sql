CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enterprise_inquiry" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enterprise_inquiry" ADD COLUMN "handled_by" text;--> statement-breakpoint
CREATE INDEX "admin_audit_actor_idx" ON "admin_audit_log" USING btree ("actor_email");--> statement-breakpoint
CREATE INDEX "admin_audit_action_idx" ON "admin_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_target_idx" ON "admin_audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
-- Keep parity with migration 0025 (RLS enabled on all public tables). The app
-- connects as the table owner via a direct pg Pool, which bypasses RLS, so no
-- policies are needed — this only silences the Supabase rls_disabled linter.
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;