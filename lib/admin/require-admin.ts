import "server-only";

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { adminAuditLog } from "@/db/schema";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin/auth";

/**
 * Guard for admin API routes. Reads and HMAC-verifies the `admin-session`
 * cookie and returns the super-admin email, or a ready-to-return 401 Response.
 *
 * Usage:
 *   const admin = await requireAdmin();
 *   if (admin instanceof NextResponse) return admin;   // 401 — bail
 *   // `admin` is now the verified email string
 */
export async function requireAdmin(): Promise<string | NextResponse> {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  const email = await verifyAdminToken(cookie);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return email;
}

/** Best-effort client IP for audit rows — mirrors the middleware extraction. */
export async function getAdminClientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

export interface AdminAuditInput {
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Append one row to the super-admin action trail. Best-effort: an audit-write
 * failure must never break the action it records, so this swallows errors.
 */
export async function writeAdminAudit(input: AdminAuditInput): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
    });
  } catch (err) {
    console.error("[admin-audit] failed to write audit log:", err);
  }
}
