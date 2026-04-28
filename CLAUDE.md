# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
claude --resume "team-features-frontend-implementation"

claude -r bce5148a-70ad-42fe-9900-b32ace16ed59          
---

## Project Overview

**CVR-MATE** is an automated B2B lead intelligence platform for Danish companies built on **Next.js 16 (App Router)**, **React 19**, and **TypeScript**. It pulls company data from the Danish CVR (Central Business Register) and adds AI-powered insights, CRM integrations, team workspaces, and scheduled lead triggers.

> **Important**: This project uses Next.js 16 with React 19. APIs, conventions, and file structure differ from prior versions. Read `node_modules/next/dist/docs/` before writing Next.js-specific code.

---

## Commands

```bash
# Development
pnpm dev           # Start dev server at localhost:3000
pnpm build         # Production build
pnpm start         # Start production server
pnpm lint          # ESLint check

# Database (Drizzle ORM)
pnpm db:generate   # Generate migration from schema changes
pnpm db:migrate    # Apply pending migrations to DB
pnpm db:push       # Push schema directly (dev only — skips migrations)
pnpm db:studio     # Open Drizzle Studio GUI at localhost:4983

# Stripe webhook testing (run in a separate terminal)
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

There is no test suite configured — the project relies on TypeScript strict mode and ESLint for correctness.

---

## Architecture

### Routing & Pages (`/app`)

The app uses the Next.js App Router. Public routes: `/`, `/login`, `/signup`, `/verify-email`, `/invite/[invitationId]`. Protected routes (require auth): `/dashboard`, `/search`, `/company/[vat]`, `/saved`, `/saved-searches`, `/triggers`, `/todos`, `/exports`, `/settings`, `/onboarding`.

All protected routes are guarded in `middleware.ts`, which also applies a 10 req/min rate limit on `/invite/*` paths.

### API Routes (`/app/api`)

| Prefix | Purpose |
|---|---|
| `/api/auth/[...all]` | Better Auth (handled entirely by the library) |
| `/api/cvr/*` | CVR search, company lookup, suggestions, saved companies |
| `/api/triggers/*` | Lead trigger CRUD, manual execution |
| `/api/cron/triggers` | QStash-invoked scheduled trigger runs |
| `/api/ai/*` | Gemini-powered briefings, outreach drafts, search parsing, todo suggestions |
| `/api/integrations/*` | HubSpot / LeadConnector / Pipedrive OAuth + sync |
| `/api/stripe/*` | Stripe billing webhooks + subscription management |
| `/api/notifications/*` | SSE notification stream + read-status updates |
| `/api/team/*` | Org management (invite, remove, roles, audit) |
| `/api/email/*` | Email preference management |
| `/api/dashboard` | Metrics + recent activity |
| `/api/exports/*` | Data export status |

### Database (`/db`)

**Drizzle ORM + PostgreSQL**. Schema is split across two files:

- `db/auth-schema.ts` — Better Auth tables: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`
- `db/app-schema.ts` — Application tables: `company`, `savedCompany`, `savedSearch`, `leadTrigger`, `triggerResult`, `todo`, `companyNote`, `notification`, `crmConnection`, `crmSyncMapping`, `crmSyncLog`, `subscription`, `usageRecord`, `emailLog`, `userBrand`, `activity`, `companyWorkspace`, `orgAuditLog`, and more

Most multi-user tables include an `organizationId` column for team-scoped data isolation.

Migrations live in `/drizzle/`. Always run `db:generate` after schema changes, never hand-edit migration files.

### Authentication (`/lib/auth.ts`, `/lib/auth-client.ts`)

**Better Auth** with the organization plugin. Supports email/password and Google OAuth. Email verification is required before login. Sessions last 7 days with a cookie cache (5-min max-age).

Role hierarchy: `owner (3) > admin (2) > member (1)`. Permission checks use rank comparisons — a user cannot act on someone of equal or higher rank. Teams require the Enterprise plan (`teamMemberLimit` controls access).

### State Management

- **React Query** (`@tanstack/react-query`) — all server data fetching and caching
- **Zustand** (`/lib/stores`) — client-side ephemeral state (search filters, todo UI)
- **React Context** — i18n (Danish/English toggle at `/lib/i18n`) and user brand profile

### Key Library Locations

| Path | What's there |
|---|---|
| `/lib/cvr-api.ts` | CVR registry API client |
| `/lib/ai/` | Google Gemini integration (briefings, outreach, parsing) |
| `/lib/crm/` | HubSpot, LeadConnector, Pipedrive adapters |
| `/lib/email/` | Multi-provider email dispatch (Resend primary, SendGrid, Nodemailer fallback) + React Email templates |
| `/lib/stripe/` | Plan limits, subscription helpers |
| `/lib/team/` | RBAC helpers, org audit logging |
| `/lib/hooks/` | 20+ React custom hooks |
| `/components/ui/` | shadcn/ui component library |
| `/components/landing/` | Three.js + React Three Fiber 3D hero scene |

### Scheduled Jobs

Trigger execution is scheduled via **Upstash QStash**. The cron endpoint at `/api/cron/triggers` is invoked by QStash and requires a `CRON_SECRET` header for validation.

---

## Environment Setup

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` + `NEXT_PUBLIC_BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- `CVR_API_KEY` — Danish CVR registry
- `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `STRIPE_WEBHOOK_SECRET` + price IDs
- `CRM_TOKEN_ENCRYPTION_KEY` — 32-byte hex, encrypts stored CRM OAuth tokens
- Upstash Redis + QStash keys (optional — app runs without Redis cache)
- CRM OAuth app credentials (HubSpot, LeadConnector, Pipedrive) — only needed if testing integrations
- SMTP credentials — fallback email provider

After setting up `.env`, run `pnpm db:push` to initialize the database schema, then `pnpm dev`.
