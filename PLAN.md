# CVR-MATE Production Readiness Plan

Moving an application from development to production requires a structured, multi-layered testing approach to ensure reliability, security, and performance under real-world conditions.

---

## Phase 1 — Functional & Integrity Testing

**Current state:** No test suite exists. TypeScript strict mode + ESLint are the only correctness checks.

### Test Runner Setup

Add **Vitest** (`vitest` + `@vitejs/plugin-react`) — fast, native ESM, compatible with Next.js and Drizzle without webpack overhead.

### Critical Paths (prioritised by blast radius)

| Area | What to test | Type |
|---|---|---|
| Auth flow | Login, session validation, email verification, org invite | Integration |
| Stripe webhooks | `handlePaymentSucceeded`, `handlePaymentFailed`, subscription sync | Unit + Integration |
| Plan limits | `getUserPlan()`, `getUsageSummary()`, grace period logic in `lib/stripe/entitlements.ts` | Unit |
| Trigger execution | Cron endpoint, trigger matching, result writing | Integration |
| CVR API client | Search, company lookup, participant lookup | Unit (mock CVR API) |
| CRM sync | HubSpot/Pipedrive/LeadConnector adapters — map + push | Unit (mock CRM APIs) |

Target: **80–90% coverage on critical paths** (auth, billing, triggers). Lower-priority UI paths can be deferred.

### Database Migration Testing

The app currently uses `db:push` in development — `drizzle.__drizzle_migrations` has 0 rows. Before production:

1. Provision a clean staging Supabase project
2. Run `pnpm db:migrate` from scratch against it — verify all 22 migrations apply in order
3. Verify rollback scripts exist for every destructive migration (DROP COLUMN, DROP TABLE)

### E2E Tests (Playwright)

Cover 5 smoke flows only — the revenue-critical user journeys:

1. Sign up → verify email → login
2. Search CVR → save company
3. Create trigger → manually run → see result
4. Upgrade plan (Stripe test card `4242 4242 4242 4242`)
5. Invite team member → accept invite → access shared data

### API Contract Testing

- Validate all `/api/*` route responses match their TypeScript return types
- Stripe webhook: confirm all event types handled (`customer.subscription.updated`, `invoice.payment_failed`, `invoice.payment_succeeded`)
- QStash cron: confirm `/api/cron/triggers` is idempotent — duplicate execution must not create duplicate `trigger_result` rows

---

## Phase 2 — Performance & Reliability Testing

### High-Risk Endpoints

| Endpoint | Risk | Why |
|---|---|---|
| `GET /api/cvr/search` | High | External CVR API + DB query on every call |
| `POST /api/ai/*` | High | Gemini calls — slow + rate-limited by Google |
| `GET /api/notifications` (SSE) | High | Long-lived connections per user |
| `POST /api/stripe/webhook` | Medium | Must complete quickly or Stripe retries |
| `POST /api/cron/triggers` | Medium | Can fan out to many DB writes |

### Load Testing Tool

Use **[k6](https://k6.io)** — free, TypeScript-native, outputs p95/p99 latency. No server needed.

**Key scenarios to simulate:**

1. **15 concurrent CVR searches** — validates Upstash Redis cache hit rate and CVR API rate limit behaviour
2. **Stripe webhook burst** — 20 webhooks/second to simulate payment day volume
3. **SSE connection pool** — 100 long-lived `/api/notifications` connections to check memory leak and file descriptor exhaustion

### Scalability & Reliability

- Set `MAX_DURATION` on Vercel serverless functions — increase to **60s for AI routes** (default 10s will timeout Gemini calls)
- Validate QStash retry behaviour: if `/api/cron/triggers` fails, QStash retries. Ensure trigger execution is idempotent — check for duplicate results before inserting
- Cache CVR company lookups in Upstash Redis with a 24h TTL — the CVR registry data changes rarely and is the most frequently fetched resource

---

## Phase 3 — Security & Compliance Verification

### Already Completed

- RLS enabled on all 38 public tables (eliminates all Supabase security lint errors)
- CRM tokens encrypted at rest (`CRM_TOKEN_ENCRYPTION_KEY`)
- Rate limiting on `/invite/*` in `middleware.ts`
- Stripe webhook signature verification
- Better Auth session security (7-day sessions, HTTP-only cookies)

### Remaining Gaps to Close

| Gap | Fix |
|---|---|
| No rate limiting on `/api/ai/*` | Add per-user rate limiting via Upstash Redis — these cost money per call |
| No rate limiting on CVR search | Same — CVR API has monthly usage quotas |
| No CSP headers | Add `Content-Security-Policy` header in `next.config.js` |
| GDPR — user data deletion | Ensure `DELETE /api/user` removes all rows across all user-scoped tables |
| GDPR — cookie consent | Add consent banner before setting any non-essential cookies |
| Stripe IP allowlist | Add middleware to only accept webhook requests from Stripe's published IP ranges |

### Automated Security Scans

- Run `pnpm audit` for dependency vulnerabilities — add as a required pre-deploy step
- Use [OWASP ZAP](https://www.zaproxy.org) (free) for DAST scanning against the staging environment
- Confirm no API keys or secrets are hard-coded — run `git log -p | grep -E "sk_|eyJ|AKIA"` before every release

### GDPR Compliance (Danish platform)

- Document data retention policy: how long are `activity`, `email_log`, `org_audit_log` rows kept?
- Add scheduled cleanup job (via QStash) to purge records older than the retention window
- Ensure the privacy policy covers CVR data processing (names, addresses of Danish business owners)

---

## Phase 4 — Operational Readiness

### Environment Parity

- Create a `staging` Vercel environment with its own:
  - Supabase project (separate DB, separate storage bucket)
  - Stripe test mode keys
  - Upstash Redis instance
  - QStash schedule (pointing to the staging URL)
- Add `NEXT_PUBLIC_ENV=staging` — display a visible banner in the UI so it is always obvious which environment is active
- Never run `db:push` in production — only `db:migrate`

### Error Tracking

Add **[Sentry](https://sentry.io)** via `npx @sentry/wizard@latest -i nextjs` (10-minute setup). This provides:
- Stack traces for every unhandled server error (currently a blind spot — only `console.error` exists)
- Slow API route detection
- Source map support for minified production builds
- Alert routing to email/Slack on first occurrence of a new error

### Monitoring Dashboards

| Tool | What it monitors | Setup effort |
|---|---|---|
| Vercel Analytics | Core Web Vitals per page, function invocation counts | Already available — enable in project settings |
| Upstash Redis dashboard | Cache hit rate, command latency, memory usage | Already available at console.upstash.com |
| Supabase Dashboard → Reports | Slow queries, connection pool saturation, storage usage | Already available |
| Stripe Dashboard → Monitoring | Webhook failure rate, payment success rate | Already available |
| Sentry | Application errors, p95 API latency | Install `@sentry/nextjs` |

### Rollback Procedure

1. **Code rollback:** Vercel preserves every deploy as an immutable snapshot — one click to instant revert in the Vercel dashboard
2. **DB rollback:** Maintain a `drizzle/rollback/` directory with reverse SQL for every destructive migration. Example for RLS: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
3. **Feature flags:** Wrap risky new features in an env var check (`process.env.ENABLE_X === "true"`) so they can be disabled without redeploying

### Pre-Launch Checklist

Run this once before going live:

```
[ ] pnpm build          — zero TypeScript errors, zero ESLint errors
[ ] pnpm audit          — zero high/critical dependency vulnerabilities
[ ] All Stripe webhook events registered in Stripe Dashboard
[ ] QSTASH_CURRENT_SIGNING_KEY + QSTASH_NEXT_SIGNING_KEY set in production env
[ ] CRON_SECRET set and matches QStash schedule header configuration
[ ] CRM_TOKEN_ENCRYPTION_KEY is 32 bytes of cryptographic randomness (not a password)
[ ] Supabase security linter: 0 warnings (Dashboard → Advisors → Security)
[ ] Staging deploy tested end-to-end with Stripe test cards (4242... and 4000...0002)
[ ] DNS + HTTPS configured, BETTER_AUTH_URL matches production domain exactly
[ ] NEXT_PUBLIC_BETTER_AUTH_URL matches production domain exactly
[ ] Google OAuth redirect URI updated to production domain in Google Cloud Console
[ ] Sentry DSN configured and sending test errors successfully
[ ] Rate limits verified on /api/ai/* and /api/cvr/search
[ ] User data deletion (GDPR) tested — deleting a user removes all their data
```

---

## Priority Order

The highest-leverage items to tackle first:

1. **Sentry** — 10 minutes, immediately eliminates the blind spot on production errors
2. **AI endpoint rate limiting** — Gemini has per-minute token limits; a single script can exhaust the monthly budget
3. **Staging environment** — blocks all other meaningful testing
4. **Vitest setup + billing/auth unit tests** — the two areas where bugs cost money
5. **E2E smoke tests (Playwright)** — catches regressions before every deploy
