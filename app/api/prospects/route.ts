import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contact, companyWorkspace, savedCompany } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { resolveCompanyIdByVat } from "@/lib/crm/company-resolver";
import { serializeContact } from "@/lib/crm/serialize";
import { encryptField, blindIndex, blindIndexPhone } from "@/lib/pii/crypto";
import { parseBody, prospectCreateSchema } from "@/lib/validation/crm";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";

/**
 * POST /api/prospects — the "enter CVR → auto-fill → add contacts" entry point.
 *
 * Resolves the CVR to a local company (lazily fetching + caching from the CVR
 * registry), claims it into this org's workspace as a prospect, optionally saves
 * it for the user, and creates any initial contacts (PII encrypted at rest).
 * Org-scoped and Enterprise-gated via `requireCrmOrg` — same gate as the native
 * contacts route. Idempotent: re-running for the same company updates the
 * existing workspace rather than erroring, and duplicate-email contacts are
 * skipped, not rejected.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "prospect_create", 30, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const parsed = parseBody(prospectCreateSchema, await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const companyId = await resolveCompanyIdByVat(input.vat);
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // One unit of work: a half-applied prospect (workspace claimed, some contacts
    // written) is worse than none, and the caller has no way to detect it.
    const result = await db.transaction(async (tx) => {
      // Distinguish create-vs-update for the activity log (the upsert below always
      // returns a row, so it can't tell us on its own).
      const existingWs = await tx.query.companyWorkspace.findFirst({
        where: and(
          eq(companyWorkspace.organizationId, organizationId),
          eq(companyWorkspace.companyId, companyId)
        ),
        columns: { id: true },
      });
      const workspaceCreated = !existingWs;

      // Upsert the org workspace. On conflict we only overwrite what the caller
      // explicitly sent — never silently downgrade an existing `customer` back to
      // `prospect`, and never wipe existing tags with a default empty array.
      const [workspace] = await tx
        .insert(companyWorkspace)
        .values({
          organizationId,
          companyId,
          status: input.status ?? "prospect",
          tags: input.tags ?? [],
        })
        .onConflictDoUpdate({
          target: [companyWorkspace.organizationId, companyWorkspace.companyId],
          set: {
            ...(input.status ? { status: input.status } : {}),
            ...(input.tags ? { tags: input.tags } : {}),
            updatedAt: new Date(),
          },
        })
        .returning();

      // Optional personal save (scoped per user+cvr, distinct from the org workspace).
      let saved = false;
      if (input.save) {
        await tx
          .insert(savedCompany)
          .values({
            userId,
            organizationId,
            companyId,
            cvr: input.vat,
            note: input.note ?? null,
            tags: input.tags ?? [],
          })
          .onConflictDoNothing({ target: [savedCompany.userId, savedCompany.cvr] });
        saved = true;
      }

      // Initial contacts. Dedup is delegated to `contact_org_company_email_uq`
      // rather than a preceding SELECT: check-then-insert lets two concurrent
      // requests for the same email both pass and the loser die on a 23505.
      // Sequential inserts still collapse duplicates *within* one payload, since
      // each conflicts against the row the previous iteration wrote in this tx.
      const createdContacts: ReturnType<typeof serializeContact>[] = [];
      const skippedContacts: string[] = [];
      for (const c of input.contacts ?? []) {
        const [row] = await tx
          .insert(contact)
          .values({
            companyId,
            organizationId,
            createdBy: userId,
            name: c.name,
            title: c.title ?? null,
            emailEnc: encryptField(c.email),
            phoneEnc: encryptField(c.phone),
            linkedinEnc: encryptField(c.linkedinUrl),
            notesEnc: encryptField(c.notes),
            emailHash: blindIndex(c.email),
            phoneHash: blindIndexPhone(c.phone),
            isPrimary: c.isPrimary ?? false,
            lawfulBasis: c.lawfulBasis ?? "legitimate_interest",
            source: c.source ?? "cvr",
            consentAt: c.lawfulBasis === "consent" ? new Date() : null,
          })
          // Unqualified column names: this is an index predicate, and it must
          // match `contact_org_company_email_uq` verbatim for Postgres to infer
          // the partial index as the arbiter.
          .onConflictDoNothing({
            target: [contact.organizationId, contact.companyId, contact.emailHash],
            where: sql`deleted_at is null and email_hash is not null`,
          })
          .returning();

        // No row back means the arbiter fired — an equal live contact already exists.
        if (!row) {
          skippedContacts.push(c.name);
          continue;
        }
        createdContacts.push(serializeContact(row));
      }

      return { workspace, workspaceCreated, saved, createdContacts, skippedContacts };
    });

    // Deliberately after the commit: an audit entry for writes that rolled back
    // would be a lie.
    await logActivity({
      userId,
      organizationId,
      entityType: "company",
      entityId: companyId,
      action: result.workspaceCreated ? "created" : "updated",
      metadata: {
        companyId,
        vat: input.vat,
        status: input.status ?? "prospect",
        contactsCreated: result.createdContacts.length,
        saved: result.saved,
      },
    });

    return NextResponse.json(
      {
        companyId,
        vat: input.vat,
        workspaceId: result.workspace.id,
        workspaceCreated: result.workspaceCreated,
        saved: result.saved,
        contacts: result.createdContacts,
        skippedContacts: result.skippedContacts,
      },
      { status: result.workspaceCreated ? 201 : 200 }
    );
  } catch (err) {
    return crmErrorResponse(err);
  }
}
