// tsx does not read .env — without this the script throws on QSTASH_TOKEN even
// though the value is sitting in the file.
import "dotenv/config";

import { Client } from "@upstash/qstash";

/**
 * Register the CRM's scheduled jobs with QStash.
 *
 * Both endpoints have existed since their phases shipped but were never
 * scheduled, so neither has ever run in production. Idempotent: an existing
 * schedule for the same destination is left alone, so this is safe to re-run.
 *
 *   pnpm exec tsx scripts/register-crm-schedules.ts
 *   CRM_CRON_BASE_URL=https://cvr-mate.dk pnpm exec tsx scripts/register-crm-schedules.ts
 *   DRY_RUN=1 pnpm exec tsx scripts/register-crm-schedules.ts    # print, change nothing
 */

const token = process.env.QSTASH_TOKEN;
if (!token) {
  throw new Error("QSTASH_TOKEN is not set — console.upstash.com → QStash → Details.");
}

const baseUrl = (
  process.env.CRM_CRON_BASE_URL ?? "https://cvr-mate-hfdc.vercel.app"
).replace(/\/$/, "");

if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
  throw new Error(
    `CRM_CRON_BASE_URL must be publicly reachable (got: ${baseUrl}). QStash cannot call localhost.`
  );
}

const dryRun = process.env.DRY_RUN === "1";

// Belt-and-braces: forwarding the bearer means the route authorizes even on a
// deployment where the QStash signing keys are not configured.
const cronSecret = process.env.CRON_SECRET;
const headers: Record<string, string> = { "Content-Type": "application/json" };
if (cronSecret) headers.Authorization = `Bearer ${cronSecret}`;

/**
 * The custom domain currently serves an OLDER build than the Vercel project
 * URL: cvr-mate.dk 404s on /api/cron/match-feed and /api/cron/expire-documents,
 * while serving /api/cron/triggers, /api/cron/person-changes and
 * /api/cron/data-cleanup fine. Verified by unauthenticated probe — these routes
 * fail closed, so a 401 proves the code is deployed and a 404 proves it is not.
 *
 * Routes are therefore pinned per-spec rather than sharing one base URL: a
 * global override would point expire-documents at a host where it does not
 * exist, and QStash would retry into a 404 forever without the app ever saying
 * so. THIS SPLIT IS A DEPLOYMENT BUG TO FIX, not a design choice — once
 * cvr-mate.dk is redeployed from main, drop the `host` overrides and let
 * everything share the custom domain.
 */
const LEGACY_HOST = "https://cvr-mate.dk";

interface ScheduleSpec {
  path: string;
  cron: string;
  label: string;
  why: string;
  /** Pin this schedule to a specific host. Defaults to CRM_CRON_BASE_URL. */
  host?: string;
}

const SCHEDULES: ScheduleSpec[] = [
  {
    path: "/api/cron/contract-renewals",
    // 07:00 UTC — inside the Danish working morning year-round, and well clear
    // of midnight batch traffic.
    cron: "0 7 * * *",
    label: "crm-contract-renewals-daily",
    why: "Notifies contract owners once a contract enters its renewal-notice window.",
  },
  {
    path: "/api/cron/expire-documents",
    // 02:00 UTC — runs before anyone reads the morning reports, so statuses are
    // already truthful when the day starts.
    cron: "0 2 * * *",
    label: "crm-expire-documents-daily",
    why: "Marks sent quotes past validUntil as expired and active contracts past expiryDate as expired.",
  },
  {
    path: "/api/cron/annual-reports",
    // 05:30 UTC — after expire-documents (02:00) so statuses are truthful, and
    // deliberately NOT 05:00: person-changes already runs then and also calls
    // rest.cvrapi.dk, so sharing the minute would have the two crons contend
    // for the same upstream rate limit. Still well before the Danish working
    // day, so the digest is waiting when people start.
    //
    // This schedule IS the feature's heartbeat: annual reports are filed to the
    // Regnskaber register and it is unverified whether a filing bumps the CVR
    // change feed's change_id, so the pipeline polls rather than subscribes.
    // If this schedule stops, nothing else notices a new annual report.
    cron: "30 5 * * *",
    label: "crm-annual-reports-daily",
    why: "Polls followed companies for newly filed annual reports, records the period, upserts company_metrics, and sends the daily digest.",
  },
  {
    path: "/api/cron/person-changes",
    host: LEGACY_HOST,
    // 05:00 UTC — the CVR change feed is consumed incrementally via a stored
    // cursor, so a daily run catches up on whatever accumulated rather than
    // missing anything.
    cron: "0 5 * * *",
    label: "crm-person-changes-daily",
    why: "Pulls the CVR change feed and notifies users about role changes at companies they follow.",
  },
  {
    path: "/api/cron/data-cleanup",
    host: LEGACY_HOST,
    // 03:00 UTC — the schedule the route's own docblock specifies.
    cron: "0 3 * * *",
    label: "crm-data-cleanup-daily",
    why: "GDPR retention purge: activity 90d, emailLog 90d, orgAuditLog 365d, read notifications 30d, and hard-deletes soft-deleted CRM personal data after a 30d grace window.",
  },
];

async function main() {
  const client = new Client({ token: token! });
  const existing = await client.schedules.list();

  for (const spec of SCHEDULES) {
    const destination = `${spec.host ?? baseUrl}${spec.path}`;
    const dup = existing.find((s) => s.destination === destination);

    if (dup) {
      console.log(`ℹ️  ${spec.label}: already scheduled (${dup.scheduleId}, cron "${dup.cron}") — skipping.`);
      continue;
    }

    if (dryRun) {
      console.log(`🔎 would create ${spec.label}`);
      console.log(`   destination: ${destination}`);
      console.log(`   cron:        ${spec.cron}`);
      console.log(`   purpose:     ${spec.why}`);
      continue;
    }

    const res = await client.schedules.create({
      destination,
      cron: spec.cron,
      method: "POST", // GET on these routes is a dry run and mutates nothing.
      body: JSON.stringify({}),
      headers,
      retries: 3,
      label: spec.label,
    });

    console.log(`✅ ${spec.label} registered — scheduleId ${res.scheduleId}`);
    console.log(`   ${destination}  (cron "${spec.cron}")`);
  }

  if (dryRun) console.log("\nDRY_RUN=1 — nothing was created.");
}

main().catch((err) => {
  console.error("❌ Failed to register schedules:", err);
  process.exit(1);
});
