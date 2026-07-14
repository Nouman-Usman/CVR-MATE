import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { contact } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { serializeContact } from "@/lib/crm/serialize";
import { encryptField, blindIndex } from "@/lib/pii/crypto";
import { parseBody, contactUpdateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { logOrgEvent } from "@/lib/team/audit";
import {
  assertCanMutateResource,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";

/**
 * Load a contact and enforce that it belongs to the caller's org (IDOR
 * defense — there is no DB-level RLS). Returns null if not found or foreign.
 */
async function loadOwnedContact(contactId: string, organizationId: string) {
  const row = await db.query.contact.findFirst({ where: eq(contact.id, contactId) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string; contactId: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_contact_update", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { contactId } = await params;
    const existing = await loadOwnedContact(contactId, organizationId);
    if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    // Resource-level authorization (owner/admin, or the creator).
    try {
      await assertCanMutateResource(userId, {
        userId: existing.createdBy ?? "",
        organizationId: existing.organizationId,
      });
    } catch (err) {
      if (err instanceof TeamPermissionError) {
        return NextResponse.json({ error: err.message }, { status: teamErrorToStatus(err) });
      }
      throw err;
    }

    const parsed = parseBody(contactUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const updateData: Partial<typeof contact.$inferInsert> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.title !== undefined) updateData.title = input.title ?? null;
    if (input.phone !== undefined) updateData.phoneEnc = encryptField(input.phone);
    if (input.linkedinUrl !== undefined) updateData.linkedinEnc = encryptField(input.linkedinUrl);
    if (input.notes !== undefined) updateData.notesEnc = encryptField(input.notes);
    if (input.isPrimary !== undefined) updateData.isPrimary = input.isPrimary;
    if (input.source !== undefined) updateData.source = input.source;
    if (input.lawfulBasis !== undefined) {
      updateData.lawfulBasis = input.lawfulBasis;
      updateData.consentAt =
        input.lawfulBasis === "consent" ? existing.consentAt ?? new Date() : null;
    }

    // Email change → re-encrypt, recompute blind index, re-check dedup.
    if (input.email !== undefined) {
      const emailHash = blindIndex(input.email);
      if (emailHash) {
        const dup = await db.query.contact.findFirst({
          where: and(
            eq(contact.organizationId, organizationId),
            eq(contact.companyId, existing.companyId),
            eq(contact.emailHash, emailHash),
            isNull(contact.deletedAt),
            ne(contact.id, existing.id)
          ),
          columns: { id: true },
        });
        if (dup) {
          return NextResponse.json(
            { error: "Another contact with this email already exists for this company." },
            { status: 409 }
          );
        }
      }
      updateData.emailEnc = encryptField(input.email);
      updateData.emailHash = emailHash;
    }

    const [updated] = await db
      .update(contact)
      .set(updateData)
      .where(eq(contact.id, existing.id))
      .returning();

    await logActivity({
      userId,
      organizationId,
      entityType: "contact",
      entityId: existing.id,
      action: "updated",
      metadata: { companyId: existing.companyId },
    });

    return NextResponse.json({ contact: serializeContact(updated) });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ vat: string; contactId: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const { contactId } = await params;
    const existing = await loadOwnedContact(contactId, organizationId);
    if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    try {
      await assertCanMutateResource(userId, {
        userId: existing.createdBy ?? "",
        organizationId: existing.organizationId,
      });
    } catch (err) {
      if (err instanceof TeamPermissionError) {
        return NextResponse.json({ error: err.message }, { status: teamErrorToStatus(err) });
      }
      throw err;
    }

    // Soft delete + clear the blind index so the (org,company,email) slot frees up.
    await db
      .update(contact)
      .set({ deletedAt: new Date(), emailHash: null })
      .where(eq(contact.id, existing.id));

    await logActivity({
      userId,
      organizationId,
      entityType: "contact",
      entityId: existing.id,
      action: "deleted",
      metadata: { companyId: existing.companyId },
    });
    // Security-relevant (personal data removal) — also to the org audit trail.
    await logOrgEvent({
      organizationId,
      actorId: userId,
      action: "crm_contact_deleted",
      metadata: { contactId: existing.id, companyId: existing.companyId },
    });

    return NextResponse.json({ message: "Contact deleted" });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
