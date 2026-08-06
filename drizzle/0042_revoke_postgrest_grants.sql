-- Remove the PostgREST roles' access to the application schema.
--
-- Companion to 0041 (RLS on all 59 tables). RLS alone was not enough:
--   * RLS does not apply to TRUNCATE. Verified before this migration — as
--     `anon`, `TRUNCATE account` succeeded and emptied 12 rows despite RLS
--     being enabled (rolled back). An anon-key holder could not read the data
--     but could still destroy it.
--   * RLS is a row filter, not an access control. Revoking the grant means the
--     request fails with "permission denied" instead of quietly returning an
--     empty set, which is both safer and far easier to diagnose.
--
-- Safe because nothing in this application uses PostgREST or the anon key:
-- every Supabase call goes through `service_role` (lib/videos/supabase.ts,
-- lib/attachments/storage.ts), and SUPABASE_ANON_KEY appears nowhere in the
-- codebase or the environment. The app's own connection is `postgres`.
--
-- `service_role` is deliberately untouched — the attachments bucket depends on
-- it. Only the `public` schema is affected; Supabase Storage lives in the
-- `storage` schema, so the public `cvr-videos` bucket keeps working.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint

-- Without USAGE on the schema, the roles cannot even name an object in it, so
-- a table added later is unreachable regardless of its own grants.
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;--> statement-breakpoint

-- The durable half. Supabase ships ALTER DEFAULT PRIVILEGES that re-grant
-- everything to anon/authenticated on every newly created object — the same
-- trap that silently undid four previous RLS migrations. Revoking the defaults
-- for `postgres` covers every table this project creates, because Drizzle
-- migrations run as `postgres`.
--
-- The matching defaults owned by `supabase_admin` cannot be altered from this
-- connection ("permission denied to change default privileges"). They only
-- affect objects that supabase_admin itself creates in `public`, which this
-- project does not do. Change them from the Supabase dashboard if that ever
-- stops being true.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
