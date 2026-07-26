import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, desc, count } from "drizzle-orm";
import { db } from "@/db";
import {
  user, subscription, session, usageRecord, activity, member, organization, account,
} from "@/db/schema";
import { requireAdmin, writeAdminAudit, getAdminClientIp } from "@/lib/admin/require-admin";

/** GET /api/admin/users/[id] — full user detail for the drawer. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { id } = await params;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [userRow] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [sub, sessions, usage, acts, memberships, providers] = await Promise.all([
      db.select().from(subscription).where(eq(subscription.userId, id)).limit(1).then((r) => r[0] ?? null),

      db.select({
        id: session.id, ipAddress: session.ipAddress, userAgent: session.userAgent,
        createdAt: session.createdAt, updatedAt: session.updatedAt, expiresAt: session.expiresAt,
      }).from(session).where(eq(session.userId, id)).orderBy(desc(session.updatedAt)).limit(10),

      db.select({ feature: usageRecord.feature, total: count() })
        .from(usageRecord)
        .where(and(eq(usageRecord.userId, id), gte(usageRecord.createdAt, monthStart)))
        .groupBy(usageRecord.feature).orderBy(desc(count())),

      db.select({ id: activity.id, entityType: activity.entityType, action: activity.action, createdAt: activity.createdAt })
        .from(activity).where(eq(activity.userId, id)).orderBy(desc(activity.createdAt)).limit(20),

      db.select({ role: member.role, orgId: organization.id, orgName: organization.name })
        .from(member).innerJoin(organization, eq(member.organizationId, organization.id))
        .where(eq(member.userId, id)),

      db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, id)),
    ]);

    return NextResponse.json({
      user: {
        id: userRow.id, name: userRow.name, email: userRow.email,
        emailVerified: userRow.emailVerified, image: userRow.image,
        language: userRow.language, createdAt: userRow.createdAt, updatedAt: userRow.updatedAt,
      },
      subscription: sub,
      sessions,
      usage,
      activity: acts,
      memberships,
      providers: providers.map((p) => p.providerId),
    });
  } catch (error) {
    console.error("Admin user detail failed:", error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id] — hard-delete a user (FKs cascade to their data).
 * Guarded: refuses while the user carries a live paid subscription, so we never
 * orphan an active Stripe subscription that would keep billing.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { id } = await params;
    const [userRow] = await db.select({ email: user.email }).from(user).where(eq(user.id, id)).limit(1);
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [sub] = await db.select({ status: subscription.status, plan: subscription.plan })
      .from(subscription).where(eq(subscription.userId, id)).limit(1);
    if (sub && sub.plan !== "free" && (sub.status === "active" || sub.status === "trialing")) {
      return NextResponse.json(
        { error: "User has a live paid subscription — cancel billing first (Billing page)." },
        { status: 409 }
      );
    }

    await db.delete(user).where(eq(user.id, id));
    await writeAdminAudit({
      actorEmail: admin, action: "user_deleted", targetType: "user", targetId: id,
      metadata: { email: userRow.email }, ipAddress: await getAdminClientIp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin user delete failed:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
