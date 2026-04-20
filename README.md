# CVR-MATE

CVR-MATE is an automated B2B lead intelligence platform for Danish companies.  
It helps teams search, track, and manage company data from the Danish CVR registry, with AI-assisted workflows for research and outreach.

## Overview

CVR-MATE combines CVR data access, lead monitoring, notifications, and AI tooling in a single app:

- Search and segment Danish companies
- Save companies and reusable searches
- Run scheduled trigger-based lead monitoring
- Manage company-linked todos and recent activity
- Receive real-time in-app notifications
- Generate AI briefings, search parsing, outreach drafts, and todo ideas

## Key Features

### CVR Data & Lead Discovery
- CVR search with filters (industry, location, company type, founding date, etc.)
- Company profiles (`/company/[vat]`) and participant profiles (`/person/[id]`)
- Saved companies and saved searches
- Recently viewed companies

### Sales Workflow
- Lead triggers with scheduled execution and manual runs
- Todo management tied to companies
- Export checks and data export flow
- Dashboard for pipeline/activity overview

### AI Assistance (Gemini)
- Company briefing generation
- Pipeline analysis
- Natural-language query parsing to structured filters
- Todo suggestions
- Outreach drafting and enrichment endpoints

### Collaboration & Notifications
- Better Auth authentication with organization/team features
- Real-time notifications over SSE (`/api/notifications/stream`)
- Followed-people monitoring and change alerts

### Product Experience
- Landing page with 3D hero/animation stack
- Danish/English custom i18n context

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling/UI**: Tailwind CSS 4
- **Database**: PostgreSQL + Drizzle ORM / Drizzle Kit
- **Auth**: Better Auth
- **Cache/Queue**: Upstash Redis, Upstash QStash
- **AI**: Google Generative AI (Gemini)
- **State/Data Fetching**: Zustand, TanStack React Query
- **3D/Animation**: Three.js, React Three Fiber, GSAP
- **Email/Billing**: Nodemailer/SendGrid, Stripe

## Architecture (High-Level)

```text
app/                # Next.js App Router pages + API routes
components/         # UI and feature components
db/                 # Drizzle schema + DB setup
drizzle/            # Generated Drizzle artifacts/migrations
lib/                # Domain logic (auth, ai, cvr, cron, notifications, stripe, i18n, hooks, stores)
middleware.ts       # Route protection + invite rate limiting
```

Notable architecture patterns:
- **Server routes** under `app/api/**/route.ts`
- **SSE notification fan-out** via in-process notification bus (`lib/notifications.ts`)
- **Cron processing** via secured API endpoints (`/api/cron/*`) with QStash signature verification

## Routes

### Pages

| Path | Purpose |
|---|---|
| `/` | Landing page |
| `/login` | Sign in |
| `/signup` | Create account |
| `/verify-email` | Email verification flow |
| `/onboarding` | First-time setup |
| `/dashboard` | Main dashboard |
| `/search` | CVR company search |
| `/company/[vat]` | Company details |
| `/person/[id]` | Participant/person details |
| `/saved` | Saved companies |
| `/saved-searches` | Saved search filters |
| `/recent-companies` | Recently viewed companies |
| `/followed-people` | Tracked people/participants |
| `/todos` | Task management |
| `/triggers` | Lead trigger management |
| `/exports` | Export workflows |
| `/settings` | User/org settings |
| `/invite/[invitationId]` | Team invitation acceptance |

### API (Grouped)

- **Auth**
  - `/api/auth/[...all]`
- **CVR**
  - `/api/cvr/search`, `/api/cvr/company`, `/api/cvr/suggest`, `/api/cvr/saved`, `/api/cvr/recent`, `/api/cvr/participant`
- **Dashboard / Saved / Todos / Triggers**
  - `/api/dashboard`
  - `/api/saved-searches`
  - `/api/todos`, `/api/todos/[id]`
  - `/api/triggers`, `/api/triggers/[id]`, `/api/triggers/[id]/run`
- **Notifications**
  - `/api/notifications`, `/api/notifications/[id]`, `/api/notifications/read-all`, `/api/notifications/stream` (SSE)
- **Cron Jobs**
  - `/api/cron/triggers`
  - `/api/cron/person-changes`
- **AI**
  - `/api/ai/company-briefing`, `/api/ai/analyze-pipeline`, `/api/ai/parse-search`, `/api/ai/suggest-todos`, `/api/ai/draft-outreach`, `/api/ai/enrich-company`, `/api/ai/enrich-person`, `/api/ai/enrichment`
- **Billing (Stripe)**
  - `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/subscription`, `/api/stripe/cancel`, `/api/stripe/resume`, `/api/stripe/webhook`
- **Team / Integrations / Brand / Email / Exports**
  - `/api/team/*`, `/api/integrations/*`, `/api/brand/*`, `/api/email/*`, `/api/exports/check`

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- PNPM
- PostgreSQL database

### Install & Run

```bash
pnpm install
pnpm db:push
pnpm dev
```

App runs at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values.

> ⚠️ Do not commit secrets.  
> TODO: add team-specific production values/documentation if your deployment differs.

### Core

```bash
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
CVR_API_KEY=
GEMINI_API_KEY=
```

### Optional / Feature-Specific

```bash
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Redis (optional cache)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cron/QStash
CRON_SECRET=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# CRM integrations
CRM_TOKEN_ENCRYPTION_KEY=
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
LEADCONNECTOR_CLIENT_ID=
LEADCONNECTOR_CLIENT_SECRET=
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=

# Stripe billing
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID=
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=
NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID=

# Email
SMTP_USER=
SMTP_PASS=
```

## Database & Drizzle

This repo uses Drizzle with PostgreSQL (`drizzle.config.ts`, `db/schema.ts`).

- Generate migration artifacts:
  ```bash
  pnpm db:generate
  ```
- Run migrations:
  ```bash
  pnpm db:migrate
  ```
- Push schema directly (dev convenience):
  ```bash
  pnpm db:push
  ```
- Open Drizzle Studio:
  ```bash
  pnpm db:studio
  ```

## Background Jobs / Cron Triggers

- Scheduled processing endpoints:
  - `/api/cron/triggers`
  - `/api/cron/person-changes`
- Auth model:
  - Primary: Upstash QStash signature verification
  - Fallback (manual/local): `Authorization: Bearer $CRON_SECRET`
- Trigger scheduling utilities live in `lib/cron.ts`.

## Notifications (SSE)

- Real-time stream endpoint: `/api/notifications/stream`
- Uses Server-Sent Events with heartbeat keepalive
- Current fan-out is in-process (`lib/notifications.ts`)
  - For multi-instance deployments, move fan-out to shared pub/sub (e.g., Redis pub/sub)

## AI Features (Gemini)

Gemini integration is implemented via `@google/generative-ai` in `lib/ai.ts`.

- Uses `GEMINI_API_KEY`
- Supports both text and JSON-oriented generation helpers
- Includes retry handling and rate-limit messaging for AI endpoints

## Internationalization

Custom i18n is implemented in `lib/i18n/*`:
- Supported locales: `da` (default), `en`
- Language state is handled by `LanguageProvider` with localStorage persistence

## Scripts (Linting / Testing / Formatting)

Available scripts from `package.json`:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

Notes:
- No dedicated `test` script is currently defined.
- No dedicated `format` script is currently defined.

## Billing (Stripe) Local Webhook

Stripe is actively used in this repository (`app/api/stripe/*`, `lib/stripe/*`).
To test webhook events locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Deployment

No platform-specific deployment config (such as `vercel.json` or Docker files) is committed in the root.

Generic deployment guidance:
- Deploy as a Next.js app (Node runtime)
- Provide required environment variables
- Configure scheduler/webhooks for cron and Stripe routes as needed

## Contributing

1. Create a feature branch
2. Make focused changes
3. Run `pnpm lint` and any relevant checks
4. Open a pull request with context and testing notes

## License

No license file is currently specified in this repository.
