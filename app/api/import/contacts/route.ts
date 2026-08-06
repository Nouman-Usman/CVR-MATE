import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { company, contact } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity/log";
import { encryptField, blindIndex, blindIndexPhone } from "@/lib/pii/crypto";
import { resolveCompanyIdByVat } from "@/lib/crm/company-resolver";
import {
  normaliseRows,
  findInternalDuplicates,
  type ImportField,
  type MappedRow,
} from "@/lib/import/contacts";

/** Rows per request. Beyond this the client must split the file. */
const MAX_ROWS = 2000;

type RowVerdict = "new" | "duplicate" | "duplicate-in-file" | "unknown-company";

interface PreviewRow {
  row: number;
  verdict: RowVerdict;
  cvr: string;
  companyName: string | null;
  name: string;
  email?: string;
}

/**
 * POST /api/import/contacts
 *
 * `{ records, mapping, commit }`. With `commit: false` (the default) this is a
 * dry run that classifies every row and writes nothing.
 *
 * Preview and commit deliberately share this one handler and one classification
 * pass. A separate preview endpoint drifts from the importer it describes, and
 * a preview that lies about what will happen is worse than no preview.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_import_contacts", 20, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      records?: unknown;
      mapping?: unknown;
      commit?: unknown;
    };

    const records = Array.isArray(body.records) ? (body.records as string[][]) : null;
    if (!records) {
      return NextResponse.json({ error: "records must be an array of rows" }, { status: 400 });
    }
    if (records.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows. Import at most ${MAX_ROWS} at a time.` },
        { status: 400 }
      );
    }

    const mapping = (body.mapping ?? {}) as Record<number, ImportField | null>;
    const commit = body.commit === true;

    const { rows, issues } = normaliseRows(records, mapping);
    const internalDupes = findInternalDuplicates(rows);

    // ── Resolve companies ─────────────────────────────────────────────────────
    // Only CVRs already in the local cache are resolved on preview. Creating a
    // company row is a write, and a dry run must not write.
    const cvrs = [...new Set(rows.map((r) => r.cvr))];
    const known = cvrs.length
      ? await db
          .select({ id: company.id, vat: company.vat, name: company.name })
          .from(company)
          .where(inArray(company.vat, cvrs))
      : [];
    const companyByCvr = new Map(known.map((c) => [c.vat, c]));

    // ── Existing contacts ─────────────────────────────────────────────────────
    // Matched on the email blind index, which is what the unique constraint
    // uses — so the preview's "duplicate" means exactly what the insert will do.
    const emailHashes = rows
      .map((r) => (r.email ? blindIndex(r.email) : null))
      .filter((h): h is string => !!h);

    const existing = emailHashes.length
      ? await db
          .select({ companyId: contact.companyId, emailHash: contact.emailHash })
          .from(contact)
          .where(
            and(
              eq(contact.organizationId, organizationId),
              isNull(contact.deletedAt),
              inArray(contact.emailHash, [...new Set(emailHashes)])
            )
          )
      : [];
    const existingKeys = new Set(existing.map((e) => `${e.companyId}:${e.emailHash}`));

    function classify(row: MappedRow, index: number): RowVerdict {
      const comp = companyByCvr.get(row.cvr);
      if (!comp) return "unknown-company";
      if (internalDupes.has(index)) return "duplicate-in-file";
      const hash = row.email ? blindIndex(row.email) : null;
      if (hash && existingKeys.has(`${comp.id}:${hash}`)) return "duplicate";
      return "new";
    }

    const preview: PreviewRow[] = rows.map((row, i) => {
      const comp = companyByCvr.get(row.cvr);
      return {
        row: row.sourceRow,
        verdict: classify(row, i),
        cvr: row.cvr,
        companyName: comp?.name ?? null,
        name: row.name,
        email: row.email,
      };
    });

    const summary = {
      total: rows.length,
      new: preview.filter((p) => p.verdict === "new").length,
      duplicate: preview.filter((p) => p.verdict === "duplicate").length,
      duplicateInFile: preview.filter((p) => p.verdict === "duplicate-in-file").length,
      unknownCompany: preview.filter((p) => p.verdict === "unknown-company").length,
      skipped: issues.length,
    };

    if (!commit) {
      return NextResponse.json({ committed: false, summary, preview, issues });
    }

    // ── Commit ────────────────────────────────────────────────────────────────
    let imported = 0;
    const failures: Array<{ row: number; message: string }> = [];

    for (const [i, row] of rows.entries()) {
      // Duplicates and in-file repeats are skipped, never updated: an import
      // that silently overwrites a colleague's edits is not recoverable.
      if (internalDupes.has(i)) continue;

      try {
        // Unknown CVRs are resolved (and cached) at commit time — this is the
        // write path, so creating the company row is now legitimate.
        const companyId =
          companyByCvr.get(row.cvr)?.id ?? (await resolveCompanyIdByVat(row.cvr));
        if (!companyId) {
          failures.push({ row: row.sourceRow, message: `CVR ${row.cvr} could not be resolved` });
          continue;
        }

        const inserted = await db
          .insert(contact)
          .values({
            organizationId,
            companyId,
            name: row.name,
            title: row.title ?? null,
            emailEnc: row.email ? encryptField(row.email) : null,
            emailHash: row.email ? blindIndex(row.email) : null,
            phoneEnc: row.phone ? encryptField(row.phone) : null,
            phoneHash: row.phone ? blindIndexPhone(row.phone) : null,
            linkedinEnc: row.linkedinUrl ? encryptField(row.linkedinUrl) : null,
            notesEnc: row.notes ? encryptField(row.notes) : null,
            // Provenance: the column already carries an 'import' value, and
            // knowing a contact arrived in bulk matters for a GDPR request.
            source: "import",
            createdBy: userId,
          })
          // Lets the database arbitrate rather than trusting the preview's
          // snapshot — another user may have added the same contact in between.
          .onConflictDoNothing()
          .returning({ id: contact.id });

        if (inserted.length > 0) imported++;
      } catch (rowErr) {
        // One malformed row must not abort the other 499.
        failures.push({
          row: row.sourceRow,
          message: rowErr instanceof Error ? rowErr.message : "Insert failed",
        });
      }
    }

    await logActivity({
      userId,
      organizationId,
      entityType: "contact",
      entityId: null,
      action: "created",
      metadata: { imported, source: "csv-import", attempted: rows.length },
    });

    return NextResponse.json({
      committed: true,
      imported,
      summary,
      issues,
      failures,
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
