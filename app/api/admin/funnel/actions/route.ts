import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { enterpriseInquiry } from "@/db/schema";
import { requireAdmin, writeAdminAudit, getAdminClientIp } from "@/lib/admin/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";

type Action = "mark_handled" | "mark_unhandled";

/** POST /api/admin/funnel/actions — triage an enterprise inquiry. Body: { action, id }. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const rl = await checkRateLimit(admin, "admin_funnel_action", 120, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Too many actions, slow down." }, { status: 429 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    if (action === "mark_handled") {
      await db.update(enterpriseInquiry)
        .set({ handledAt: new Date(), handledBy: admin })
        .where(eq(enterpriseInquiry.id, id));
    } else if (action === "mark_unhandled") {
      await db.update(enterpriseInquiry)
        .set({ handledAt: null, handledBy: null })
        .where(eq(enterpriseInquiry.id, id));
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    await writeAdminAudit({
      actorEmail: admin, action: "inquiry_marked_handled", targetType: "inquiry", targetId: id,
      metadata: { handled: action === "mark_handled" }, ipAddress: await getAdminClientIp(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin funnel action failed:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
