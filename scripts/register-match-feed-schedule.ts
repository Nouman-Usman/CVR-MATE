import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;
if (!token) {
  throw new Error("QSTASH_TOKEN is not set — grab it from console.upstash.com → QStash → Details.");
}

const destination =
  process.env.MATCH_FEED_CRON_URL ?? "https://cvr-mate-hfdc.vercel.app/api/cron/match-feed";

if (destination.includes("<YOUR_APP_DOMAIN>") || destination.includes("localhost")) {
  throw new Error(
    `Set MATCH_FEED_CRON_URL to your public production URL (got: ${destination}). ` +
      "QStash must reach it over the internet — localhost will not work."
  );
}

// Optional belt-and-suspenders: forward a Bearer token so the route authorizes even
// if the QStash signing keys are not configured on the deployment. Harmless when they are.
const cronSecret = process.env.CRON_SECRET;
const headers: Record<string, string> = { "Content-Type": "application/json" };
if (cronSecret) headers.Authorization = `Bearer ${cronSecret}`;

async function main() {
  const client = new Client({ token: token! });

  // Idempotency: skip if a schedule already targets this destination (the SDK's
  // CreateScheduleRequest has no deduplicationId, so we check the list ourselves).
  const existing = await client.schedules.list();
  const dup = existing.find((s) => s.destination === destination);
  if (dup) {
    console.log("ℹ️  A schedule already targets this destination — nothing to do.");
    console.log("   scheduleId:", dup.scheduleId, "| cron:", dup.cron);
    return;
  }

  const res = await client.schedules.create({
    destination,
    cron: "0 * * * *", // top of every hour, UTC — the route shards by Copenhagen hour internally
    method: "POST",
    body: JSON.stringify({}),
    headers,
    retries: 3,
    label: "match-feed-hourly",
  });

  console.log("✅ Match-feed schedule registered.");
  console.log("   scheduleId:", res.scheduleId);
  console.log("   destination:", destination);
  console.log("   cron: 0 * * * * (hourly, UTC)");
}

main().catch((err) => {
  console.error("❌ Failed to register schedule:", err);
  process.exit(1);
});
