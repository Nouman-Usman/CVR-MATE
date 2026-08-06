import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { activity, user } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * GET /api/activity/actors — the distinct people who appear in this org's
 * history, for the audit page's "who" filter.
 *
 * Deliberately not derived from the org's *current* member list: someone who
 * has since left still authored events, and a history view that cannot filter
 * by them is missing exactly the person you are usually looking for.
 */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_activity_actors", 60, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const rows = await db
      .selectDistinct({ userId: activity.userId })
      .from(activity)
      .where(eq(activity.organizationId, organizationId));

    const ids = rows.map((r) => r.userId);
    if (ids.length === 0) return NextResponse.json({ actors: [] });

    const actors = await db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .where(inArray(user.id, ids));

    // Stable, human order — the filter is a dropdown, not a ranked list.
    actors.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "da"));

    return NextResponse.json({ actors });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
