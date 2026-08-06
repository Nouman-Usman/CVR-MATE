-- Enable Row Level Security on every public table, with NO policies.
--
-- With RLS on and no policy, Postgres denies every row to any role that does
-- not bypass RLS. That is the intent: this database is a Supabase project, and
-- Supabase grants `anon` and `authenticated` SELECT/INSERT/UPDATE/DELETE on all
-- 59 public tables and serves them over PostgREST. Without RLS, possession of
-- the (publishable, by-design) anon key is enough to read `user`, `session`,
-- `account`, `contact` and every commercial document in the system.
--
-- The application is unaffected: it connects as `postgres`, which holds
-- rolbypassrls, so RLS is invisible to Drizzle. Verified before applying —
-- this is not an assumption.
--
-- WHY THIS IS THE FIFTH ATTEMPT: migrations 0022, 0025, 0026 and 0028 all ran
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY, and the live database had it off
-- on all 59 tables. Raw-SQL RLS is not represented in the Drizzle schema, so
-- any table recreated by `db:push` (which CLAUDE.md recommends for dev) comes
-- back without it, silently. This migration is generated from `.enableRLS()`
-- in db/*-schema.ts instead, so the schema is now the source of truth and
-- push/generate both preserve it.

ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "change_feed_cursor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_landing_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_briefing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_note" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_segment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_workspace" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contact" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contract" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "crm_connection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "crm_sync_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "crm_sync_mapping" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_sequence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "enterprise_inquiry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feature_video" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "features" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "followed_person" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interaction_attachment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_trigger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_feed_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outreach_message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "person_company_index" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "person_role_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "person_role_snapshot" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pipeline" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pipeline_stage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profile_enrichment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_line" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales_order" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales_order_line" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_company" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_search" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "segment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "todo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trigger_result" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_record" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_brand" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_video_view" ENABLE ROW LEVEL SECURITY;