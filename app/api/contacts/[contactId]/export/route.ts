import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contact, activity, deal } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { serializeContact } from "@/lib/crm/serialize";
import { logActivity } from "@/lib/activity/log";
import { logOrgEvent } from "@/lib/team/audit";

/**
 * GET /api/contacts/[contactId]/export — GDPR data-subject export (Art. 15/20).
 *
 * Returns all personal data held about a single contact — decrypted fields plus
 * the activity trail and any deals they are the primary contact on — as a
 * downloadable JSON document. Access is org-scoped; the export itself is
 * audit-logged because it materializes plaintext PII.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    const { contactId } = await params;

    const row = await db.query.contact.findFirst({ where: eq(contact.id, contactId) });
    // IDOR defense: only export a contact belonging to the caller's org.
    if (!row || row.organizationId !== organizationId) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const [activities, deals] = await Promise.all([
      db.query.activity.findMany({
        where: and(
          eq(activity.organizationId, organizationId),
          eq(activity.entityType, "contact"),
          eq(activity.entityId, contactId)
        ),
        orderBy: [desc(activity.createdAt)],
        limit: 500,
      }),
      db.query.deal.findMany({
        where: and(
          eq(deal.organizationId, organizationId),
          eq(deal.primaryContactId, contactId),
          isNull(deal.deletedAt)
        ),
        columns: { id: true, title: true, amount: true, currency: true, status: true, createdAt: true },
      }),
    ]);

    const document = {
      exportedAt: new Date().toISOString(),
      exportType: "gdpr_data_subject_export",
      contact: serializeContact(row),
      activity: activities.map((a) => ({
        action: a.action,
        entityType: a.entityType,
        metadata: a.metadata,
        createdAt: a.createdAt,
      })),
      deals,
    };

    // Audit: this materializes plaintext personal data.
    await logOrgEvent({
      organizationId,
      actorId: userId,
      action: "crm_data_exported",
      metadata: { contactId, companyId: row.companyId },
    });
    await logActivity({
      userId,
      organizationId,
      entityType: "contact",
      entityId: contactId,
      action: "exported",
      metadata: { companyId: row.companyId },
    });

    return new NextResponse(JSON.stringify(document, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="contact-${contactId}.json"`,
      },
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
