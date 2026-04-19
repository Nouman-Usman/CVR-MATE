CREATE TABLE "org_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_audit_log" ADD CONSTRAINT "org_audit_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_audit_log" ADD CONSTRAINT "org_audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_audit_log" ADD CONSTRAINT "org_audit_log_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "org_audit_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "org_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "org_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "org_audit_log" USING btree ("organization_id","action");