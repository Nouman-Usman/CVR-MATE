-- Rollback for: 0025_enable_rls_crm_tables.sql
--
-- Disables Row Level Security on the native-CRM tables.
-- Run via: psql $DATABASE_URL -f drizzle/rollback/0025_disable_rls_crm_tables.sql
--
-- WARNING: After running this script, the Supabase auto-REST (PostgREST)
-- endpoints for these tables would be exposed without row-level access control.
-- Only run if reverting the RLS migration in an emergency.

ALTER TABLE "public"."contact" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pipeline" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pipeline_stage" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."deal" DISABLE ROW LEVEL SECURITY;
