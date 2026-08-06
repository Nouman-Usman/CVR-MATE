import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc, gte, lte, inArray, count } from "drizzle-orm";
import { db } from "@/db";
import { activity, company } from "@/db/schema";
import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { parsePagination } from "@/lib/crm/serialize";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  type ActivityAction,
  type ActivityEntityType,
} from "@/lib/activity/vocabulary";

type ActivityRow = typeof activity.$inferSelect & {
  user?: { id: string; name: string | null; image: string | null } | null;
};

function serializeActivity(row: ActivityRow, vatById: Map<string, string>) {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const companyId = typeof metadata.companyId === "string" ? metadata.companyId : null;
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    metadata,
    companyVat: companyId ? (vatById.get(companyId) ?? null) : null,
    actor: row.user ? { id: row.user.id, name: row.user.name, image: row.user.image } : null,
    createdAt: row.createdAt,
  };
}

/**
 * Read a repeatable filter param, keeping only values in the known vocabulary.
 *
 * Unknown values are dropped rather than rejected: these arrive from query
 * strings that outlive deploys (bookmarks, back button), and a 400 on a
 * retired entity type would break a saved link for no safety benefit. Dropping
 * everything would widen the result set, so an all-invalid filter is reported
 * back as `empty` and the caller returns nothing.
 */
function parseEnumFilter<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[]
): { values: T[]; empty: boolean } {
  const raw = params.getAll(key).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  if (raw.length === 0) return { values: [], empty: false };
  const values = raw.filter((v): v is T => (allowed as readonly string[]).includes(v));
  return { values, empty: values.length === 0 };
}

/** `YYYY-MM-DD` → an instant, or null when absent/malformed. */
function parseDay(value: string | null, endOfDay: boolean): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/activity — the org-wide audit history.
 *
 * Every CRM mutation already called `logActivity`, but nothing read it back
 * except the per-company timeline, so "who deleted this contact last Tuesday"
 * had no answer short of a SQL console. This is that view.
 *
 * Filters: `entityType`, `action` (both repeatable or comma-separated),
 * `userId`, `from`, `to` (YYYY-MM-DD, inclusive). Returns `total` so the client
 * can page honestly rather than guessing from a short page.
 *
 * Org-scoped like every other CRM read — there is no DB-level RLS, so the
 * organizationId predicate is the isolation boundary and is applied first.
 */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "crm_activity_feed", 120, 60);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const params = req.nextUrl.searchParams;
    const { limit, offset } = parsePagination(params, { defaultLimit: 50, maxLimit: 100 });

    const entityTypes = parseEnumFilter<ActivityEntityType>(
      params,
      "entityType",
      ACTIVITY_ENTITY_TYPES
    );
    const actions = parseEnumFilter<ActivityAction>(params, "action", ACTIVITY_ACTIONS);

    // Every requested value was unrecognised — return nothing rather than
    // silently ignoring the filter and showing the unfiltered feed.
    if (entityTypes.empty || actions.empty) {
      return NextResponse.json({ activity: [], total: 0, limit, offset });
    }

    const actorId = params.get("userId")?.trim() || null;
    const from = parseDay(params.get("from"), false);
    const to = parseDay(params.get("to"), true);

    const where = and(
      eq(activity.organizationId, organizationId),
      entityTypes.values.length ? inArray(activity.entityType, entityTypes.values) : undefined,
      actions.values.length ? inArray(activity.action, actions.values) : undefined,
      actorId ? eq(activity.userId, actorId) : undefined,
      from ? gte(activity.createdAt, from) : undefined,
      to ? lte(activity.createdAt, to) : undefined
    );

    // Count and page in parallel: the count is what makes "showing 50 of 1,240"
    // truthful, and it is the same predicate so it shares the index.
    const [rows, [totals]] = await Promise.all([
      db.query.activity.findMany({
        where,
        orderBy: [desc(activity.createdAt)],
        limit,
        offset,
        with: { user: { columns: { id: true, name: true, image: true } } },
      }),
      db.select({ value: count() }).from(activity).where(where),
    ]);

    // `metadata.companyId` is an internal UUID, but every company link in the
    // app is keyed by CVR. Resolving here — one query for the whole page, not
    // one per row — is what makes each entry clickable instead of a dead label.
    const companyIds = [
      ...new Set(
        rows
          .map((r) => (r.metadata as Record<string, unknown> | null)?.companyId)
          .filter((v): v is string => typeof v === "string")
      ),
    ];
    const vatById = new Map<string, string>();
    if (companyIds.length > 0) {
      const companies = await db
        .select({ id: company.id, vat: company.vat })
        .from(company)
        .where(inArray(company.id, companyIds));
      for (const c of companies) vatById.set(c.id, c.vat);
    }

    return NextResponse.json({
      activity: rows.map((r) => serializeActivity(r, vatById)),
      total: totals?.value ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

