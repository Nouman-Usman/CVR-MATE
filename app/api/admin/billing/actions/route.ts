import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { requireAdmin, writeAdminAudit, getAdminClientIp } from "@/lib/admin/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";

type Action = "cancel_subscription" | "extend_trial";

/**
 * POST /api/admin/billing/actions
 * Body: { action, userId, days? }.
 * - cancel_subscription: Stripe-backed subs cancel at period end; comped
 *   (no Stripe id) subs are marked canceled locally.
 * - extend_trial: sets/extends the trial window on the user's subscription.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const rl = await checkRateLimit(admin, "admin_billing_action", 60, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Too many actions, slow down." }, { status: 429 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    const userId = String(body.userId ?? "");
    const ip = await getAdminClientIp();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const [sub] = await db.select().from(subscription).where(eq(subscription.userId, userId)).limit(1);
    if (!sub) return NextResponse.json({ error: "No subscription for user" }, { status: 404 });

    if (action === "cancel_subscription") {
      if (sub.stripeSubscriptionId) {
        await getStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
        await db.update(subscription).set({ cancelAtPeriodEnd: true, updatedAt: new Date() }).where(eq(subscription.userId, userId));
      } else {
        // Comped / non-Stripe subscription — cancel locally.
        await db.update(subscription).set({ status: "canceled", updatedAt: new Date() }).where(eq(subscription.userId, userId));
      }
      await writeAdminAudit({ actorEmail: admin, action: "subscription_canceled", targetType: "subscription", targetId: userId, metadata: { stripe: !!sub.stripeSubscriptionId }, ipAddress: ip });
      return NextResponse.json({ ok: true, message: sub.stripeSubscriptionId ? "Will cancel at period end." : "Subscription canceled." });
    }

    if (action === "extend_trial") {
      const days = Math.min(90, Math.max(1, Number(body.days) || 14));
      const now = new Date();
      const base = sub.trialEnd && sub.trialEnd > now ? sub.trialEnd : now;
      const trialEnd = new Date(base.getTime() + days * 86400_000);
      await db.update(subscription)
        .set({ status: "trialing", trialStart: sub.trialStart ?? now, trialEnd, updatedAt: now })
        .where(eq(subscription.userId, userId));
      await writeAdminAudit({ actorEmail: admin, action: "user_trial_extended", targetType: "subscription", targetId: userId, metadata: { days }, ipAddress: ip });
      return NextResponse.json({ ok: true, message: `Trial extended by ${days} day(s).` });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin billing action failed:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
