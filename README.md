# CVR-MATE

Automated B2B lead intelligence platform for Danish companies. Search, track, and manage company data sourced from the Danish CVR registry with AI-powered insights.

## Tech Stack

- **Framework** — Next.js 16 (App Router), React 19, TypeScript
- **Styling** — Tailwind CSS 4
- **Database** — PostgreSQL via Drizzle ORM
- **Auth** — Better Auth
- **Cache** — Upstash Redis
- **AI** — Google Generative AI (Gemini)
- **State** — Zustand, TanStack React Query
- **3D / Animation** — Three.js, React Three Fiber, GSAP
- **i18n** — Custom language context (Danish / English)

## Features

- **Company Search** — Query the CVR API with advanced segmentation filters (industry, location, size, status, etc.)
- **Company Profiles** — Detailed view per company with denormalized CVR data, notes, and linked todos
- **Saved Companies** — Bookmark companies for quick access
- **Saved Searches** — Persist filter combinations and re-run them later
- **Lead Triggers** — Automated, scheduled searches (daily/weekly/cron) with in-app notifications when new matches appear
- **Todos** — Task management tied to specific companies with priority and due dates
- **Notifications** — Real-time notification stream (SSE) for trigger results, system events, and exports
- **AI Assistants** — Company briefings, pipeline analysis, natural-language search parsing, todo suggestions, and outreach drafting
- **Dashboard** — Overview of key metrics and recent activity
- **Data Export** — Export company lists and search results
- **Landing Page** — 3D hero scene with GSAP scroll animations

## Routes

### Pages

| Path | Description |
|---|---|
| `/` | Landing page |
| `/login` | Sign in |
| `/signup` | Create account |
| `/dashboard` | Main dashboard |
| `/search` | Company search with filters |
| `/company/[vat]` | Company detail page |
| `/saved` | Saved companies |
| `/saved-searches` | Saved search filters |
| `/recent-companies` | Recently viewed companies |
| `/todos` | Task management |
| `/triggers` | Lead trigger configuration |
| `/exports` | Data exports |
| `/settings` | User settings |

### API

| Endpoint | Description |
|---|---|
| `/api/auth/[...all]` | Authentication (Better Auth) |
| `/api/cvr/search` | Search CVR registry |
| `/api/cvr/company` | Fetch / upsert single company |
| `/api/cvr/suggest` | Autocomplete suggestions |
| `/api/cvr/saved` | Saved companies CRUD |
| `/api/cvr/recent` | Recently viewed companies |
| `/api/saved-searches` | Saved searches CRUD |
| `/api/todos` | Todos CRUD |
| `/api/todos/[id]` | Single todo operations |
| `/api/triggers` | Lead triggers CRUD |
| `/api/triggers/[id]` | Single trigger operations |
| `/api/triggers/[id]/run` | Manually run a trigger |
| `/api/cron/triggers` | Cron endpoint for scheduled triggers |
| `/api/notifications` | Notifications list |
| `/api/notifications/[id]` | Single notification operations |
| `/api/notifications/read-all` | Mark all as read |
| `/api/notifications/stream` | SSE notification stream |
| `/api/dashboard` | Dashboard metrics |
| `/api/ai/company-briefing` | AI company briefing |
| `/api/ai/analyze-pipeline` | AI pipeline analysis |
| `/api/ai/parse-search` | Natural-language to search filters |
| `/api/ai/suggest-todos` | AI todo suggestions |
| `/api/ai/draft-outreach` | AI outreach email drafts |

## Getting Started

```bash
pnpm install
pnpm db:push       # push schema to database
pnpm dev            # start dev server at localhost:3000
```


```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```