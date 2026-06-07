# RLS Migration & Deployment Guide

## What Changed

All 40+ database tables now have row-level security (RLS) enabled. This restricts data access based on user identity and organizational membership.

## For Developers

- API routes continue to work without changes (RLS enforces at DB layer)
- Queries automatically filtered by auth.uid() / org membership
- Cannot accidentally query cross-user or cross-org data
- If queries return 0 rows, check if user has proper RLS permissions
- Backend services (cron jobs, webhooks) use service role tokens for elevated access

## For Operations

Deploy all migrations in order:

```bash
pnpm db:push  # Applies 0024–0036 migrations
```

**Migration files:**
- 0024: RLS helper functions
- 0025–0026: Auth tables (account, session, user, verification)
- 0027: Org tables (organization, member, invitation)
- 0028–0029: User data (brand, activity, todo, video, notification)
- 0030–0031: Company data (company, briefing, metrics, notes)
- 0032: CRM tables
- 0033: Outreach & leads
- 0034: Admin & system
- 0035: Platform features
- 0036: External/index data

**No downtime required** — RLS added non-destructively.

**Test in staging first** — verify app functionality with RLS enabled.

## Emergency Disablement

If critical issues arise, disable RLS on a table (temporary, debugging only):

```sql
ALTER TABLE "table_name" DISABLE ROW LEVEL SECURITY;
```

**Do not leave disabled in production.** Re-enable after fixing root cause.

## Monitoring

Watch for:
- "permission denied" errors in logs (policy too restrictive)
- Unexpected "0 rows" results (verify user has membership)
- CRM integration failures (ensure service role has org access)
- Admin dashboard blank (verify admin membership & role >= 2)

## References

- Full compliance: `docs/rls-compliance.md`
- Policy details: Individual migration files (0024–0036)
- Helper functions: `drizzle/0024_rls_helpers.sql`
