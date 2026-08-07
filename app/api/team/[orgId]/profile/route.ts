export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizationProfile } from "@/db/schema";
import { getCompanyByVat } from "@/lib/cvr-api";
import {
  assertPermission,
  assertUserIsMemberOfOrg,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation/crm";
import { organizationProfileUpdateSchema } from "@/lib/validation/organization";

/**
 * The organization's issuer identity — the seller block on every quote and
 * order it sends.
 *
 * GET is open to any member (the app renders it); writes need the same
 * authority as renaming the org, since both change how the organization
 * presents itself, and this one decides what appears on documents that carry
 * commercial weight.
 */

function permissionResponse(err: unknown) {
  if (err instanceof TeamPermissionError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: teamErrorToStatus(err) }
    );
  }
  throw err;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();
  const { orgId } = await ctx.params;

  try {
    await assertUserIsMemberOfOrg(session.user.id, orgId);
  } catch (err) {
    return permissionResponse(err);
  }

  const profile = await db.query.organizationProfile.findFirst({
    where: eq(organizationProfile.organizationId, orgId),
  });

  return NextResponse.json({ profile: profile ?? null });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();
  const { orgId } = await ctx.params;

  const rl = await checkRateLimit(session.user.id, "org_profile_write", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    await assertPermission(session.user.id, orgId, "rename_org");
  } catch (err) {
    return permissionResponse(err);
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = parseBody(organizationProfileUpdateSchema, raw);
  if (!parsed.ok) return badRequest(parsed.error);

  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(patch).length === 0) return badRequest("Nothing to update");

  /**
   * A hand-edit revokes the registry claim.
   *
   * Once someone changes these values by hand they are no longer what the CVR
   * registry returned, so continuing to report `source: 'cvr'` would be a lie —
   * and the whole reason the column exists is to be trustworthy later. Use the
   * POST endpoint below to re-verify and earn the flag back.
   */
  const [updated] = await db
    .update(organizationProfile)
    .set({ ...patch, source: "manual", cvrVerifiedAt: null })
    .where(eq(organizationProfile.organizationId, orgId))
    .returning();

  if (!updated) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  await logOrgEvent({
    organizationId: orgId,
    actorId: session.user.id,
    action: "org_profile_updated",
    metadata: { fields: Object.keys(patch) },
  });

  return NextResponse.json({ profile: updated });
}

/**
 * POST — re-verify the profile against the CVR registry.
 *
 * Overwrites the registered fields with what the registry currently says and
 * restores `source: 'cvr'`. This is how a customer relocating gets picked up:
 * without it, stale data and a deliberate override are indistinguishable, so
 * nothing could ever be safely refreshed.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();
  const { orgId } = await ctx.params;

  const rl = await checkRateLimit(session.user.id, "org_profile_write", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    await assertPermission(session.user.id, orgId, "rename_org");
  } catch (err) {
    return permissionResponse(err);
  }

  const existing = await db.query.organizationProfile.findFirst({
    where: eq(organizationProfile.organizationId, orgId),
  });
  if (!existing) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!existing.cvr) return badRequest("This organization has no CVR number to verify against");

  try {
    const registry = await getCompanyByVat(Number(existing.cvr));
    if (!registry?.vat) return badRequest("The registry did not recognise that CVR number");

    const [updated] = await db
      .update(organizationProfile)
      .set({
        legalName: registry.life?.name?.trim() || existing.legalName,
        addressLine: registry.address?.street ?? existing.addressLine,
        zipCode: registry.address?.zipcode ? String(registry.address.zipcode) : existing.zipCode,
        city: registry.address?.cityname ?? existing.city,
        // Contact details are commonly overridden on purpose (a sales address
        // rather than the registered one), so they are only filled when blank.
        email: existing.email ?? registry.contact?.email ?? null,
        phone: existing.phone ?? registry.contact?.phone ?? null,
        website: existing.website ?? registry.contact?.www ?? null,
        source: "cvr",
        cvrVerifiedAt: new Date(),
      })
      .where(eq(organizationProfile.organizationId, orgId))
      .returning();

    await logOrgEvent({
      organizationId: orgId,
      actorId: session.user.id,
      action: "org_profile_verified",
      metadata: { cvr: existing.cvr },
    });

    return NextResponse.json({ profile: updated });
  } catch (err) {
    console.error("[team/profile] CVR verification failed:", err);
    return NextResponse.json(
      { error: "Could not reach the CVR registry. Try again shortly." },
      { status: 502 }
    );
  }
}
