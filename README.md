# CVR-MATE

CVR-MATE is a modern B2B lead intelligence platform for Danish companies that want to discover, understand, and act on new business opportunities with greater speed and precision. It combines publicly available company data, team workflows, AI assistance, and automation in a single product.

## Why CVR-MATE exists

For non-technical teams, CVR-MATE turns complex business registry information into a practical sales and growth workflow. Instead of manually researching companies, reviewing scattered data, and tracking follow-ups in separate tools, users can search, qualify, monitor, and act on opportunities from one place.

For technical teams, CVR-MATE is a full-stack application that brings together secure authentication, structured data access, background jobs, API integrations, and AI-powered assistance in a production-ready architecture.

## Who it is for

- Sales and business development teams looking for qualified leads
- Growth teams that need better visibility into target companies
- Operations teams that want to automate monitoring and follow-up
- Product and engineering teams that need a modern, extensible platform foundation

## What the product does

### For business users

- Discover Danish companies using structured search and filters
- Review company profiles, participants, and recent activity
- Save important companies and reusable searches
- Create and manage tasks tied to companies and opportunities
- Monitor companies and people for changes over time
- Generate AI-assisted summaries, outreach drafts, and follow-up suggestions
- Collaborate with teammates through shared workflows and notifications

### For technical users

- Serve a modern Next.js application with authenticated routes and API endpoints
- Integrate with the Danish CVR data source and enrich company records
- Support scheduled automation and event-driven workflows
- Use AI services for briefing, parsing, and content generation
- Manage subscriptions, billing, and team access through Stripe and auth integrations

## Core capabilities

- CVR-based company discovery and company profile views
- Saved companies, saved searches, and recently viewed companies
- Trigger-based lead monitoring with scheduled execution
- Todo and workflow management linked to companies
- Real-time notifications and team collaboration features
- AI-powered briefings, search parsing, outreach drafting, and enrichment helpers
- Billing, subscription, and team management features

## Tech stack

- Frontend: Next.js 16, React 19, TypeScript
- UI styling: Tailwind CSS 4, shadcn-style components, Framer Motion
- Data and persistence: PostgreSQL, Drizzle ORM, Drizzle Kit
- Authentication: Better Auth with organization/team support
- State and data fetching: Zustand and TanStack React Query
- Background jobs and scheduling: Upstash QStash and Redis
- AI: Google Gemini integration
- Integrations: Stripe, email delivery, CRM-related adapters, and notification pipelines
- Visualization and experience layer: Three.js, React Three Fiber, GSAP

## Repository structure

```text
app/            # App Router pages and API routes
components/    # UI and feature-specific components
lib/            # Domain logic, integrations, auth, AI, notifications, Stripe, and utilities
db/             # Database schema and Drizzle setup
drizzle/        # Generated migrations and SQL artifacts
middleware.ts   # Route protection and request filtering
```

## Architecture highlights

- The app uses the Next.js App Router for page and API route organization.
- Server-side logic is concentrated under the API routes in [app/api](app/api) and supporting modules in [lib](lib).
- Authentication, route protection, and invite-rate limiting are handled in [lib/auth.ts](lib/auth.ts) and [middleware.ts](middleware.ts).
- Database access is managed through Drizzle with schema definitions in [db](db).
- Notifications and scheduled workflows are implemented through dedicated API endpoints and supporting services.

## Getting started

### Prerequisites

- Node.js 20+ (LTS recommended)
- PNPM
- PostgreSQL

### Local setup

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm dev
```

The application will be available at http://localhost:3000.

## Environment configuration

Copy [.env.example](.env.example) to `.env` and provide the required values before running the app.

### Core variables

```bash
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
CVR_API_KEY=
GEMINI_API_KEY=
```

### Optional integrations

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
CRM_TOKEN_ENCRYPTION_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
SMTP_USER=
SMTP_PASS=
```

## Common development commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test:run
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

## Local webhook testing

For Stripe webhook testing locally, run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Security and operations

- Secrets should remain in environment variables and never be committed to source control.
- Authentication and team access are handled through Better Auth and organization-aware middleware.
- Protected endpoints and webhooks should be validated using the project’s existing server-side security patterns.
- Optional Redis/QStash services can extend caching and scheduled automation capabilities.

## Contributing

1. Create a feature branch.
2. Make focused, well-scoped changes.
3. Run linting and relevant checks before submitting.
4. Open a pull request with a clear summary of the change and its impact.

## License

No license has been specified for this repository yet.
