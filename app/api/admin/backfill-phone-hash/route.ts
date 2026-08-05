import { NextResponse } from "next/server";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { contact } from "@/db/schema";
import { requireAdmin, writeAdminAudit, getAdminClientIp } from "@/lib/admin/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptField, blindIndexPhone } from "@/lib/pii/crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/admin/backfill-phone-hash
 *
 * One-time (idempotent) backfill of `contact.phoneHash` for rows created before
 * the own-records phone search existed. Decrypts each contact's phone with the
 * PII key and recomputes the blind index — so it MUST run in-server (server-only
 * crypto) and reuses `blindIndexPhone` (the same normalization the search + write
 * paths use, no drift). Only touches live rows that have a phone but no hash yet.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const rl = await checkRateLimit(admin, "admin_backfill_phone_hash", 5, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many runs, slow down." }, { status: 429 });
  }

  try {
    const rows = await db.query.contact.findMany({
      where: and(
        isNull(contact.phoneHash),
        isNotNull(contact.phoneEnc),
        isNull(contact.deletedAt)
      ),
      columns: { id: true, phoneEnc: true },
    });

    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      const hash = blindIndexPhone(decryptField(row.phoneEnc));
      if (!hash) {
        skipped++; // undecryptable or non-numeric phone — leave for manual review
        continue;
      }
      await db.update(contact).set({ phoneHash: hash }).where(eq(contact.id, row.id));
      updated++;
    }

    const result = { candidates: rows.length, updated, skipped };
    await writeAdminAudit({
      actorEmail: admin,
      action: "backfill_phone_hash",
      targetType: "contact",
      metadata: result,
      ipAddress: await getAdminClientIp(),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Admin phone-hash backfill failed:", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
