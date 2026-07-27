import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leadTrigger, changeFeedCursor } from "@/db/schema";
import { requireAdmin, writeAdminAudit, getAdminClientIp } from "@/lib/admin/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";

type Action = "queue_trigger" | "clear_lock";

/**
 * POST /api/admin/health/actions
 * - queue_trigger { triggerId }: sets nextRunAt = now so the QStash cron picks
 *   it up on its next tick (we can't run it inline — that needs the owner's session).
 * - clear_lock { feedType }: releases a stuck change-feed distributed lock.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const rl = await checkRateLimit(admin, "admin_health_action", 60, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Too many actions, slow down." }, { status: 429 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    const ip = await getAdminClientIp();

    if (action === "queue_trigger") {
      const triggerId = String(body.triggerId ?? "");
      if (!triggerId) return NextResponse.json({ error: "triggerId required" }, { status: 400 });
      await db.update(leadTrigger).set({ nextRunAt: new Date(), updatedAt: new Date() }).where(eq(leadTrigger.id, triggerId));
      await writeAdminAudit({ actorEmail: admin, action: "trigger_run", targetType: "trigger", targetId: triggerId, ipAddress: ip });
      return NextResponse.json({ ok: true, message: "Trigger queued for the next cron run." });
    }

    if (action === "clear_lock") {
      const feedType = String(body.feedType ?? "");
      if (!feedType) return NextResponse.json({ error: "feedType required" }, { status: 400 });
      await db.update(changeFeedCursor).set({ isProcessing: false, processingStartedAt: null }).where(eq(changeFeedCursor.feedType, feedType));
      await writeAdminAudit({ actorEmail: admin, action: "changefeed_lock_cleared", targetType: "change_feed", targetId: feedType, ipAddress: ip });
      return NextResponse.json({ ok: true, message: "Lock cleared." });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin health action failed:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
