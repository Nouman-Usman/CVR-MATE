import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { company, deal } from "@/db/schema";
import { collectFollowUps } from "@/lib/follow-up/collect";
import { isSignalKey, type SignalKey } from "@/lib/follow-up/keys";
import { crmErrorResponse, requireCrmOrg } from "@/lib/crm/guard";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * GET /api/follow-ups — what needs chasing today, for the active org.
 *
 * The queue is computed per request rather than stored (see lib/follow-up/
 * collect.ts). Rows are enriched here, in two batched queries, so the client
 * renders a card without a lookup per row.
 *
 * Reasons come back as `{ key, params }`, never as sentences: the same payload
 * has to render Danish in the UI and the recipient's own language in the digest
 * email, so the choice belongs to the renderer.
 *
 * Org isolation is enforced in every signal's WHERE clause. There is no working
 * DB-level RLS in this app — application filtering is the only isolation there
 * is (see lib/crm/guard.ts).
 */

const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "follow_ups", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const params = req.nextUrl.searchParams;

    // Unknown signal names are dropped rather than rejected: the filter is a
    // convenience, and a stale bookmark should degrade to "everything".
    const only = (params.get("signal") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is SignalKey => isSignalKey(value));

    const requestedLimit = Number(params.get("limit"));
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(MAX_LIMIT, Math.trunc(requestedLimit))
        : MAX_LIMIT;

    const scope = params.get("scope") === "mine" ? "mine" : "org";

    const { items, counts, generatedAt } = await collectFollowUps({
      organizationId,
      only: only.length ? only : undefined,
    });

    // ── Enrich: one query for deals, one for companies ────────────────────────
    const dealIds = [
      ...new Set(items.filter((i) => i.subject.type === "deal").map((i) => i.subject.id)),
    ];
    const companyIds = [...new Set(items.map((i) => i.companyId))];

    const [dealRows, companyRows] = await Promise.all([
      dealIds.length
        ? db
            .select({
              id: deal.id,
              title: deal.title,
              amount: deal.amount,
              assignedUserId: deal.assignedUserId,
              createdBy: deal.createdBy,
              stageId: deal.stageId,
            })
            .from(deal)
            .where(
              and(
                eq(deal.organizationId, organizationId),
                isNull(deal.deletedAt),
                inArray(deal.id, dealIds)
              )
            )
        : Promise.resolve([]),
      companyIds.length
        ? db
            .select({ id: company.id, name: company.name, vat: company.vat })
            .from(company)
            .where(inArray(company.id, companyIds))
        : Promise.resolve([]),
    ]);

    const dealById = new Map(dealRows.map((row) => [row.id, row]));
    const companyById = new Map(companyRows.map((row) => [row.id, row]));

    const enriched = items.map((item) => {
      const dealRow = item.subject.type === "deal" ? dealById.get(item.subject.id) : undefined;
      const companyRow = companyById.get(item.companyId);
      return {
        subject: item.subject,
        score: item.score,
        companyId: item.companyId,
        companyName: companyRow?.name ?? null,
        companyVat: companyRow?.vat ?? null,
        dealTitle: dealRow?.title ?? null,
        dealAmount: dealRow?.amount ?? null,
        stageId: dealRow?.stageId ?? null,
        assignedUserId: dealRow?.assignedUserId ?? null,
        signalKey: item.primary.signalKey,
        reason: item.primary.reason,
        daysDelta: item.primary.daysDelta,
        action: item.primary.action ?? null,
        others: item.others.map((other) => ({
          signalKey: other.signalKey,
          reason: other.reason,
          daysDelta: other.daysDelta,
          action: other.action ?? null,
        })),
      };
    });

    // "Mine" means a deal this user owns. Company-subject cards have no owner,
    // so they only ever appear in the org view — deliberately: an unclaimed
    // follow-up belongs to whoever looks first, not to nobody.
    const scoped =
      scope === "mine"
        ? enriched.filter((item) => {
            const dealRow =
              item.subject.type === "deal" ? dealById.get(item.subject.id) : undefined;
            if (!dealRow) return false;
            return dealRow.assignedUserId === userId || dealRow.createdBy === userId;
          })
        : enriched;

    return NextResponse.json({
      items: scoped.slice(0, limit),
      total: scoped.length,
      counts,
      generatedAt,
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}
