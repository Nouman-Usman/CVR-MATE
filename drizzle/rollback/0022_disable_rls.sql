-- Rollback for: 0022_enable_rls_all_tables.sql

-- Disables Row Level Security on all 38 public tables.
-- Run via: psql $DATABASE_URL -f drizzle/rollback/0022_disable_rls.sql
--
-- WARNING: After running this script, all Supabase auto-REST (PostgREST)
-- endpoints will be exposed without row-level access control.
-- Only run if reverting the RLS migration in an emergency.

ALTER TABLE "public"."user" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."session" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."account" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."verification" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."member" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invitation" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_metrics" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."saved_company" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."saved_search" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lead_trigger" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."trigger_result" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notification" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."todo" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_note" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."org_audit_log" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."enterprise_inquiry" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_brand" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_log" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_briefing" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."outreach_message" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_enrichment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."activity" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_workspace" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."followed_person" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."person_company_index" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."person_role_snapshot" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."person_role_event" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."change_feed_cursor" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."crm_connection" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."crm_sync_mapping" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."crm_sync_log" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscription" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."usage_record" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."features" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."feature_video" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_video_view" DISABLE ROW LEVEL SECURITY;
