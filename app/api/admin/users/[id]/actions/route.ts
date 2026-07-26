import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, subscription, session } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, writeAdminAudit, getAdminClientIp } from "@/lib/admin/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolvePlanId, type PlanId } from "@/lib/stripe/plans";

type Action = "resend_verification" | "force_verify" | "revoke_sessions" | "set_plan" | "extend_trial";
const VALID_PLANS: PlanId[] = ["free", "starter", "professional", "enterprise"];

/**
 * POST /api/admin/users/[id]/actions
 * Body: { action, plan?, days? }. One endpoint for every mutating user action so
 * the auth guard, rate limit, and audit write live in a single place.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  // Light rate limit so a runaway client can't hammer these; admin is trusted, fail open.
  const rl = await checkRateLimit(admin, "admin_user_action", 120, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Too many actions, slow down." }, { status: 429 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    const ip = await getAdminClientIp();

    const [target] = await db.select({ id: user.id, email: user.email, name: user.name })
      .from(user).where(eq(user.id, id)).limit(1);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    switch (action) {
      case "resend_verification": {
        await auth.api.sendVerificationEmail({ body: { email: target.email } });
        await writeAdminAudit({ actorEmail: admin, action: "user_verify_resent", targetType: "user", targetId: id, metadata: { email: target.email }, ipAddress: ip });
        return NextResponse.json({ ok: true, message: "Verification email sent." });
      }

      case "force_verify": {
        await db.update(user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(user.id, id));
        await writeAdminAudit({ actorEmail: admin, action: "user_force_verified", targetType: "user", targetId: id, metadata: { email: target.email }, ipAddress: ip });
        return NextResponse.json({ ok: true, message: "Email marked verified." });
      }

      case "revoke_sessions": {
        const deleted = await db.delete(session).where(eq(session.userId, id)).returning({ id: session.id });
        await writeAdminAudit({ actorEmail: admin, action: "user_sessions_revoked", targetType: "user", targetId: id, metadata: { count: deleted.length }, ipAddress: ip });
        return NextResponse.json({ ok: true, message: `Revoked ${deleted.length} session(s).` });
      }

      case "set_plan": {
        const plan = resolvePlanId(String(body.plan ?? ""));
        if (!VALID_PLANS.includes(plan) || String(body.plan) !== plan) {
          return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
        }
        const [existing] = await db.select({ id: subscription.id, plan: subscription.plan })
          .from(subscription).where(eq(subscription.userId, id)).limit(1);
        if (existing) {
          await db.update(subscription)
            .set({ plan, status: "active", updatedAt: new Date() })
            .where(eq(subscription.userId, id));
        } else {
          await db.insert(subscription).values({ userId: id, plan, status: "active" });
        }
        await writeAdminAudit({ actorEmail: admin, action: "user_plan_changed", targetType: "user", targetId: id, metadata: { plan, comped: true, from: existing?.plan ?? "none" }, ipAddress: ip });
        return NextResponse.json({ ok: true, message: `Plan set to ${plan} (comped).` });
      }

      case "extend_trial": {
        const days = Math.min(90, Math.max(1, Number(body.days) || 14));
        const now = new Date();
        const [existing] = await db.select().from(subscription).where(eq(subscription.userId, id)).limit(1);
        if (existing) {
          const base = existing.trialEnd && existing.trialEnd > now ? existing.trialEnd : now;
          const trialEnd = new Date(base.getTime() + days * 86400_000);
          await db.update(subscription)
            .set({ status: "trialing", trialStart: existing.trialStart ?? now, trialEnd, updatedAt: now })
            .where(eq(subscription.userId, id));
        } else {
          const plan = resolvePlanId(String(body.plan ?? "professional"));
          await db.insert(subscription).values({
            userId: id, plan, status: "trialing",
            trialStart: now, trialEnd: new Date(now.getTime() + days * 86400_000),
          });
        }
        await writeAdminAudit({ actorEmail: admin, action: "user_trial_extended", targetType: "user", targetId: id, metadata: { days }, ipAddress: ip });
        return NextResponse.json({ ok: true, message: `Trial extended by ${days} day(s).` });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin user action failed:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
