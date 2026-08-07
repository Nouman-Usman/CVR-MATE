export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { db } from "@/db";
import { organization, member } from "@/db/auth-schema";
import { organizationProfile } from "@/db/schema";
import { getCompanyByVat } from "@/lib/cvr-api";
import { assertCanCreateOrg, TeamPermissionError, teamErrorToStatus } from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation/crm";
import { organizationCreateSchema } from "@/lib/validation/organization";

/**
 * POST /api/team/create — create an organization together with its profile.
 *
 * The profile is mandatory, not an afterthought. An org's profile is the issuer
 * identity stamped onto every quote and order it sends, and while it did not
 * exist those documents went out with no address at all — the field was
 * hardcoded null in `lib/quotes/build-snapshot.ts` because there was nowhere to
 * read one from. Creating an org without one just recreates that state.
 *
 * Both rows are written in a single transaction for the same reason: an
 * organization that exists without a profile is precisely the condition this
 * endpoint is here to prevent.
 */
export async function POST(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const rl = await checkRateLimit(session.user.id, "team_create_org", 10, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  const raw = await req.json().catch(() => ({}));
  const parsed = parseBody(organizationCreateSchema, raw);
  if (!parsed.ok) return badRequest(parsed.error);
  const { name, slug, profile } = parsed.data;

  // Plan enforcement — only Enterprise can create orgs.
  try {
    await assertCanCreateOrg(session.user.id);
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  const orgSlug =
    slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    `org-${crypto.randomUUID().slice(0, 8)}`;

  /**
   * Provenance is decided here, never by the client.
   *
   * A caller can claim `source: "cvr"`, but the claim only survives if the
   * registry actually answers for that CVR. If the lookup fails the org is
   * still created — a third-party outage should not block someone starting a
   * team — but it is recorded as `manual` with no `cvrVerifiedAt`. Saying "we
   * verified this" when we did not is worse than saying nothing, because the
   * whole point of the column is to be trustworthy later.
   */
  let source: "cvr" | "manual" = "manual";
  let cvrVerifiedAt: Date | null = null;
  if (profile.source === "cvr" && profile.cvr) {
    try {
      const registry = await getCompanyByVat(Number(profile.cvr));
      if (registry?.vat) {
        source = "cvr";
        cvrVerifiedAt = new Date();
      }
    } catch {
      // Fall through as manual; the values the user confirmed are still stored.
    }
  }

  const orgId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(organization).values({ id: orgId, name, slug: orgSlug });

      await tx.insert(member).values({
        id: memberId,
        organizationId: orgId,
        userId: session.user.id,
        role: "owner",
      });

      await tx.insert(organizationProfile).values({
        organizationId: orgId,
        legalName: profile.legalName,
        cvr: profile.cvr ?? null,
        addressLine: profile.addressLine,
        zipCode: profile.zipCode ?? null,
        city: profile.city ?? null,
        countryCode: profile.countryCode,
        email: profile.email ?? null,
        phone: profile.phone ?? null,
        website: profile.website ?? null,
        brandColor: profile.brandColor ?? null,
        source,
        cvrVerifiedAt,
      });
    });

    await logOrgEvent({
      organizationId: orgId,
      actorId: session.user.id,
      action: "org_created",
      metadata: { name, slug: orgSlug, cvr: profile.cvr ?? null, source },
    });

    return NextResponse.json({ id: orgId, name, slug: orgSlug, source });
  } catch (err) {
    console.error("[team/create] Failed:", err);
    if (err instanceof Error && err.message.includes("unique")) {
      return NextResponse.json(
        { error: "An organization with this slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }
}
