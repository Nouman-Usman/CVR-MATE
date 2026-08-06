import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { interaction, interactionAttachment } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse, CrmConflictError } from "@/lib/crm/guard";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { assertCanMutateResource } from "@/lib/team/permissions";
import { attachmentStorage } from "@/lib/attachments/storage";

/**
 * DELETE /api/attachments/[id]
 *
 * Soft-deletes the row and removes the object.
 *
 * Order matters: the conditional soft-delete runs first and is the claim. If it
 * matches no row the request lost a race and nothing is removed from storage —
 * doing the storage delete first would destroy the bytes and then discover the
 * caller had no right to.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_attachment_delete", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const { id } = await params;

    const existing = await db.query.interactionAttachment.findFirst({
      where: eq(interactionAttachment.id, id),
    });
    if (!existing || existing.organizationId !== organizationId || existing.deletedAt) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const owner = await db.query.interaction.findFirst({
      where: eq(interaction.id, existing.interactionId),
    });
    if (!owner || owner.organizationId !== organizationId) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Uploader or an admin — matches the rule for the interaction it hangs off.
    await assertCanMutateResource(userId, {
      userId: existing.uploadedBy ?? owner.createdBy ?? "",
      organizationId,
    });

    const [claimed] = await db
      .update(interactionAttachment)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(interactionAttachment.id, id),
          eq(interactionAttachment.organizationId, organizationId),
          isNull(interactionAttachment.deletedAt)
        )
      )
      .returning();

    if (!claimed) throw new CrmConflictError("This attachment was already deleted.");

    // Best effort: the row is already gone from every read path, so a storage
    // failure leaves an orphaned object rather than a file the UI still lists.
    try {
      await attachmentStorage().remove([claimed.storagePath]);
    } catch (storageErr) {
      console.error("Failed to remove attachment object:", claimed.storagePath, storageErr);
    }

    await logActivity({
      userId,
      organizationId,
      entityType: "interaction",
      entityId: owner.id,
      action: "updated",
      metadata: { companyId: owner.companyId, attachmentRemoved: claimed.filename },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
