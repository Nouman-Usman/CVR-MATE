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

interface ScheduleSpec {
  path: string;
  cron: string;
  label: string;
  why: string;
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
];

async function main() {
  const client = new Client({ token: token! });
  const existing = await client.schedules.list();

  for (const spec of SCHEDULES) {
    const destination = `${baseUrl}${spec.path}`;
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
