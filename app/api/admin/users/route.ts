import { NextRequest, NextResponse } from "next/server";
import { and, or, eq, ilike, isNull, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { user, subscription } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/require-admin";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

/**
 * GET /api/admin/users
 * List/search/filter/paginate users, joined to their subscription for plan+status.
 * Query params: q, plan, verified ('true'|'false'), page, limit.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() ?? "";
    const plan = sp.get("plan") ?? "";
    const verified = sp.get("verified"); // 'true' | 'false' | null
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("limit")) || PAGE_SIZE_DEFAULT));
    const offset = (page - 1) * limit;

    const conds = [];
    if (q) conds.push(or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`)));
    if (verified === "true") conds.push(eq(user.emailVerified, true));
    if (verified === "false") conds.push(eq(user.emailVerified, false));
    if (plan) {
      // Users with no subscription row are treated as "free".
      conds.push(plan === "free"
        ? or(isNull(subscription.plan), eq(subscription.plan, "free"))
        : eq(subscription.plan, plan));
    }
    const where = conds.length ? and(...conds) : undefined;

    const [rows, totalRow] = await Promise.all([
      db.select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        language: user.language,
        createdAt: user.createdAt,
        plan: subscription.plan,
        status: subscription.status,
        trialEnd: subscription.trialEnd,
      })
        .from(user)
        .leftJoin(subscription, eq(subscription.userId, user.id))
        .where(where)
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset(offset),

      db.select({ value: count() })
        .from(user)
        .leftJoin(subscription, eq(subscription.userId, user.id))
        .where(where)
        .then((r) => r[0]?.value ?? 0),
    ]);

    return NextResponse.json({ users: rows, total: totalRow, page, limit });
  } catch (error) {
    console.error("Admin users list failed:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
