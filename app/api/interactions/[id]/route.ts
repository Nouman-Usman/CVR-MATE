import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { interaction, contact, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { serializeInteraction } from "@/lib/crm/serialize";
import { encryptField } from "@/lib/pii/crypto";
import { parseBody, interactionUpdateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { syncFollowUpTodo } from "@/lib/crm/interactions";
import {
  assertCanMutateResource,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";

/**
 * Load an interaction and enforce it belongs to the caller's org (IDOR defense —
 * no DB-level RLS). Returns null if not found, foreign, or soft-deleted.
 */
async function loadOwnedInteraction(id: string, organizationId: string) {
  const row = await db.query.interaction.findFirst({ where: eq(interaction.id, id) });
  if (!row || row.organizationId !== organizationId || row.deletedAt) return null;
  return row;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const row = await loadOwnedInteraction(id, organizationId);
    if (!row) return NextResponse.json({ error: "Interaction not found" }, { status: 404 });
    return NextResponse.json({ interaction: serializeInteraction(row) });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_interaction_update", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;
    const existing = await loadOwnedInteraction(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Interaction not found" }, { status: 404 });

    // Resource authz: owner/admin, or the creator.
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

    const parsed = parseBody(interactionUpdateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    // Validate any newly-referenced contact/deal against this org + company.
    if (input.contactId) {
      const ok = await db.query.contact.findFirst({
        where: and(
          eq(contact.id, input.contactId),
          eq(contact.organizationId, organizationId),
          eq(contact.companyId, existing.companyId),
          isNull(contact.deletedAt)
        ),
        columns: { id: true },
      });
      if (!ok) return NextResponse.json({ error: "Contact not found" }, { status: 400 });
    }
    if (input.dealId) {
      const ok = await db.query.deal.findFirst({
        where: and(
          eq(deal.id, input.dealId),
          eq(deal.organizationId, organizationId),
          eq(deal.companyId, existing.companyId)
        ),
        columns: { id: true },
      });
      if (!ok) return NextResponse.json({ error: "Deal not found" }, { status: 400 });
    }

    const updateData: Partial<typeof interaction.$inferInsert> = {};
    if (input.type !== undefined) updateData.type = input.type;
    if (input.direction !== undefined) updateData.direction = input.direction;
    if (input.occurredAt !== undefined && input.occurredAt) {
      updateData.occurredAt = new Date(input.occurredAt);
    }
    if (input.subject !== undefined) updateData.subject = input.subject ?? null;
    if (input.body !== undefined) updateData.bodyEnc = encryptField(input.body);
    if (input.topics !== undefined) updateData.topics = input.topics;
    if (input.nextStep !== undefined) updateData.nextStep = input.nextStep ?? null;
    if (input.nextStepAt !== undefined) updateData.nextStepAt = input.nextStepAt ?? null;
    if (input.contactId !== undefined) updateData.contactId = input.contactId ?? null;
    if (input.dealId !== undefined) updateData.dealId = input.dealId ?? null;

    const [updated] = await db
      .update(interaction)
      .set(updateData)
      .where(eq(interaction.id, existing.id))
      .returning();

    // Re-sync the follow-up todo against the interaction's effective next-step.
    await syncFollowUpTodo({
      interactionId: updated.id,
      userId,
      organizationId,
      companyId: updated.companyId,
      nextStep: updated.nextStep,
      nextStepAt: updated.nextStepAt,
    });

    await logActivity({
      userId,
      organizationId,
      entityType: "interaction",
      entityId: updated.id,
      action: "updated",
      metadata: { companyId: updated.companyId, type: updated.type },
    });

    return NextResponse.json({ interaction: serializeInteraction(updated) });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const { id } = await params;
    const existing = await loadOwnedInteraction(id, organizationId);
    if (!existing) return NextResponse.json({ error: "Interaction not found" }, { status: 404 });

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

    await db
      .update(interaction)
      .set({ deletedAt: new Date() })
      .where(eq(interaction.id, existing.id));

    await logActivity({
      userId,
      organizationId,
      entityType: "interaction",
      entityId: existing.id,
      action: "deleted",
      metadata: { companyId: existing.companyId },
    });

    return NextResponse.json({ message: "Interaction deleted" });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
