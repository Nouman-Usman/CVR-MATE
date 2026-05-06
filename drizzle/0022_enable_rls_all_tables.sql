-- Enable Row Level Security on all public tables.
-- This app uses Drizzle ORM via a direct Postgres superuser connection (DATABASE_URL),
-- which bypasses RLS. PostgREST (Supabase auto-REST) is not used by the app.
-- Enabling RLS with no permissive policies blocks all PostgREST access by default,
-- eliminating the Supabase security lint warnings without affecting any app functionality.

-- Auth tables (managed by Better Auth)
ALTER TABLE "public"."user" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."session" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."account" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."verification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."organization" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."member" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."invitation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Application tables
ALTER TABLE "public"."company" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."company_metrics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."saved_company" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."saved_search" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."lead_trigger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."trigger_result" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."notification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."todo" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."company_note" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."org_audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."enterprise_inquiry" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."user_brand" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."email_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."company_briefing" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."outreach_message" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."profile_enrichment" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."activity" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."company_workspace" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."followed_person" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."person_company_index" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."person_role_snapshot" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."person_role_event" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."change_feed_cursor" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."crm_connection" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."crm_sync_mapping" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."crm_sync_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."subscription" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."usage_record" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."features" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."feature_video" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."user_video_view" ENABLE ROW LEVEL SECURITY;
