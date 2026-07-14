-- Enable Row Level Security on the native-CRM tables added in 0024.
-- Consistent with 0022: the app connects via a direct Postgres superuser
-- (DATABASE_URL) which bypasses RLS, so this does NOT provide tenant isolation
-- (that is enforced in the application layer — see lib/crm/guard.ts). Enabling
-- RLS with no permissive policies blocks Supabase PostgREST auto-REST access by
-- default and silences the Supabase security-lint warnings.

ALTER TABLE "public"."contact" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."pipeline" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."pipeline_stage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."deal" ENABLE ROW LEVEL SECURITY;
