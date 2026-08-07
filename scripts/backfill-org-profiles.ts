// tsx does not read .env on its own.
import "dotenv/config";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "../db";
import { organization, member } from "../db/auth-schema";
import { organizationProfile, userBrand } from "../db/app-schema";

/**
 * Give every existing organization a profile.
 *
 * Orgs created before profiles existed have no issuer identity, so their quotes
 * render with no address — the field was hardcoded null in build-snapshot.ts
 * because there was nowhere to read one from. This fills each one from the
 * owner's `userBrand` (the only company data those orgs have) and then enriches
 * it from the CVR registry, which is where the address actually lives.
 *
 * Idempotent: an org that already has a profile is skipped, so re-running is
 * safe and changes nothing.
 *
 *   DRY_RUN=1 pnpm exec tsx scripts/backfill-org-profiles.ts   # report only
 *   pnpm exec tsx scripts/backfill-org-profiles.ts
 *
 * `lib/cvr-api.ts` is `server-only` and cannot be imported from a plain script,
 * so the one registry call it needs is inlined below rather than dragging the
 * whole module boundary into a one-off migration tool.
 */

const dryRun = process.env.DRY_RUN === "1";

interface CvrCompanyLite {
  vat?: number;
  life?: { name?: string | null } | null;
  address?: {
    street?: string | null;
    zipcode?: number | null;
    cityname?: string | null;
  } | null;
  contact?: { email?: string | null; phone?: string | null; www?: string | null } | null;
}

/**
 * Match the normalisation `lib/validation/organization.ts` applies on the API
 * path. Without it, a profile written by this script and one written by the
 * app end up in different shapes — "freos.dk" versus "https://freos.dk" — and
 * the difference only surfaces the day something turns the value into a link.
 */
function normaliseUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

async function lookupCvr(cvr: string): Promise<CvrCompanyLite | null> {
  const apiKey = process.env.CVR_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://rest.cvrapi.dk/v2/dk/company/${cvr}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as CvrCompanyLite;
  } catch {
    return null;
  }
}

async function main() {
  const orgs = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .leftJoin(organizationProfile, eq(organizationProfile.organizationId, organization.id))
    .where(isNull(organizationProfile.id));

  if (orgs.length === 0) {
    console.log("Every organization already has a profile — nothing to do.");
    return;
  }

  console.log(`${orgs.length} organization(s) without a profile.\n`);

  for (const org of orgs) {
    // The owner's brand is the best available guess at the org's identity: for
    // every org in this database the owner is also its only member.
    const [owner] = await db
      .select({ userId: member.userId })
      .from(member)
      .where(and(eq(member.organizationId, org.id), eq(member.role, "owner")))
      .limit(1);

    const brand = owner
      ? await db.query.userBrand.findFirst({ where: eq(userBrand.userId, owner.userId) })
      : undefined;

    const cvr = brand?.cvr?.trim() || null;
    const registry = cvr ? await lookupCvr(cvr) : null;

    const profile = {
      organizationId: org.id,
      legalName: brand?.companyName?.trim() || org.name,
      cvr,
      addressLine: registry?.address?.street ?? null,
      zipCode: registry?.address?.zipcode ? String(registry.address.zipcode) : null,
      city: registry?.address?.cityname ?? null,
      countryCode: "DK",
      email: registry?.contact?.email ?? null,
      phone: registry?.contact?.phone ?? null,
      website: normaliseUrl(brand?.website || registry?.contact?.www),
      brandColor: null,
      // Only claim registry provenance when the registry actually answered.
      source: registry ? ("cvr" as const) : ("manual" as const),
      cvrVerifiedAt: registry ? new Date() : null,
    };

    const gaps = [!profile.legalName && "name", !profile.addressLine && "address"].filter(
      Boolean
    );

    console.log(`${dryRun ? "would fill" : "filling  "} ${org.name}`);
    console.log(`   legal:   ${profile.legalName}`);
    console.log(`   cvr:     ${profile.cvr ?? "(none)"}  source=${profile.source}`);
    console.log(
      `   address: ${profile.addressLine ?? "(none)"}, ${profile.zipCode ?? ""} ${profile.city ?? ""}`.trimEnd()
    );
    if (gaps.length) {
      // Deliberately not fatal. The columns are nullable so legacy orgs can be
      // filled with whatever is knowable; new orgs are held to name+address by
      // the Zod schema at creation. missingSellerFields() keeps surfacing the
      // gap at send time until someone completes it in settings.
      console.log(`   ⚠ still missing: ${gaps.join(", ")} — fix in Settings → Team`);
    }

    if (!dryRun) {
      await db.insert(organizationProfile).values(profile).onConflictDoNothing();
    }
    console.log("");
  }

  console.log(dryRun ? "DRY_RUN=1 — nothing was written." : "Backfill complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
