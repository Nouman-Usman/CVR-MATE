import { NextResponse } from "next/server";
import { eq, and, count, gte, desc, isNull, sql } from "drizzle-orm";
import {
  savedCompany,
  savedSearch,
  leadTrigger,
  triggerResult,
  todo,
  deal,
  quote,
  salesOrder,
  contract,
  interaction,
} from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { validateActiveOrg } from "@/lib/team/permissions";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    // Run all queries in parallel
    const [
      savedCompanyCount,
      savedSearchCount,
      activeTriggerCount,
      activeTaskCount,
      recentTriggerResults,
      weeklyActivity,
    ] = await Promise.all([
      // Saved companies count
      db
        .select({ value: count() })
        .from(savedCompany)
        .where(eq(savedCompany.userId, userId))
        .then((r) => r[0]?.value ?? 0),

      // Saved searches count
      db
        .select({ value: count() })
        .from(savedSearch)
        .where(eq(savedSearch.userId, userId))
        .then((r) => r[0]?.value ?? 0),

      // Active triggers count
      db
        .select({ value: count() })
        .from(leadTrigger)
        .where(
          and(eq(leadTrigger.userId, userId), eq(leadTrigger.isActive, true))
        )
        .then((r) => r[0]?.value ?? 0),

      // Active tasks count
      db
        .select({ value: count() })
        .from(todo)
        .where(
          and(eq(todo.userId, userId), eq(todo.isCompleted, false))
        )
        .then((r) => r[0]?.value ?? 0),

      // Recent trigger results (last 10 with companies)
      db.query.triggerResult.findMany({
        where: eq(triggerResult.userId, userId),
        orderBy: [desc(triggerResult.createdAt)],
        limit: 10,
        with: {
          trigger: {
            columns: { name: true },
          },
        },
      }),

      // Weekly activity — trigger results per day for the last 7 days
      (async () => {
        const results = await db.query.triggerResult.findMany({
          where: and(
            eq(triggerResult.userId, userId),
            gte(triggerResult.createdAt, weekStart)
          ),
          columns: { createdAt: true, matchCount: true },
        });

        // Group by day-of-week (Mon=0 .. Sun=6)
        const days = [0, 0, 0, 0, 0, 0, 0];
        for (const r of results) {
          const d = new Date(r.createdAt);
          // JS getDay: 0=Sun, convert to Mon=0
          const dayIdx = (d.getDay() + 6) % 7;
          days[dayIdx] += r.matchCount;
        }
        return days;
      })(),
    ]);

    // Flatten trigger results into company rows for the table
    const recentCompanies: {
      name: string;
      industry: string;
      employees: string;
      score: string;
      date: string;
      vat: number;
      triggerName: string;
    }[] = [];

    for (const tr of recentTriggerResults) {
      const companies = (tr.companies ?? []) as {
        vat: number;
        name: string;
        city: string;
        industry: string;
        founded: string;
      }[];
      for (const c of companies.slice(0, 3)) {
        recentCompanies.push({
          name: c.name,
          industry: c.industry,
          employees: "",
          score: "HIGH",
          date: new Date(tr.createdAt).toISOString().split("T")[0],
          vat: c.vat,
          triggerName: (tr.trigger as { name: string } | null)?.name ?? "",
        });
      }
      if (recentCompanies.length >= 8) break;
    }

    // Native-CRM metrics — additive and org-scoped. Omitted entirely when the
    // user has no active org, so personal dashboards are unaffected and the
    // client simply has fewer metrics to offer in the picker.
    let pipeline: {
      byStatus: { status: string; total: number; count: number }[];
      openValue: number;
      openCount: number;
    } | null = null;

    let crm: Record<string, number> | null = null;

    const activeOrgId = await validateActiveOrg(
      userId,
      session.session?.activeOrganizationId
    );
    if (activeOrgId) {
      // All five run in parallel; each is a single grouped aggregate against an
      // org-scoped index rather than loading rows into JS.
      const [dealRows, quoteRow, orderRow, contractRow, activityRow] = await Promise.all([
        db
          .select({
            status: deal.status,
            total: sql<string>`coalesce(sum(${deal.amount}), 0)`,
            count: count(),
          })
          .from(deal)
          .where(and(eq(deal.organizationId, activeOrgId), isNull(deal.deletedAt)))
          .groupBy(deal.status),

        // FILTER rather than five separate queries: one index scan answers
        // every quote question on the card set.
        db
          .select({
            openCount: sql<string>`count(*) filter (where ${quote.status} in ('draft','sent'))`,
            openValue: sql<string>`coalesce(sum(${quote.total}) filter (where ${quote.status} in ('draft','sent')), 0)`,
            acceptedValue: sql<string>`coalesce(sum(${quote.total}) filter (where ${quote.status} in ('accepted','converted')), 0)`,
            awaitingReply: sql<string>`count(*) filter (where ${quote.status} = 'sent')`,
          })
          .from(quote)
          .where(and(eq(quote.organizationId, activeOrgId), isNull(quote.deletedAt)))
          .then((r) => r[0]),

        db
          .select({
            openCount: sql<string>`count(*) filter (where ${salesOrder.status} in ('open','confirmed'))`,
            openValue: sql<string>`coalesce(sum(${salesOrder.total}) filter (where ${salesOrder.status} in ('open','confirmed')), 0)`,
            fulfilledValue: sql<string>`coalesce(sum(${salesOrder.total}) filter (where ${salesOrder.status} = 'fulfilled'), 0)`,
          })
          .from(salesOrder)
          .where(and(eq(salesOrder.organizationId, activeOrgId), isNull(salesOrder.deletedAt)))
          .then((r) => r[0]),

        // `current_date` keeps the expiry window on the same basis as the
        // reports and the renewal cron, rather than the Node process clock.
        db
          .select({
            activeCount: sql<string>`count(*) filter (where ${contract.status} in ('active','renewed'))`,
            activeValue: sql<string>`coalesce(sum(${contract.value}) filter (where ${contract.status} in ('active','renewed')), 0)`,
            expiringSoon: sql<string>`count(*) filter (where ${contract.status} in ('active','renewed') and ${contract.expiryDate} <= current_date + 30)`,
          })
          .from(contract)
          .where(and(eq(contract.organizationId, activeOrgId), isNull(contract.deletedAt)))
          .then((r) => r[0]),

        // Two windows in one pass so the card can show a real week-on-week
        // delta instead of a number with no context.
        db
          .select({
            thisWeek: sql<string>`count(*) filter (where ${interaction.occurredAt} >= now() - interval '7 days')`,
            prevWeek: sql<string>`count(*) filter (where ${interaction.occurredAt} >= now() - interval '14 days' and ${interaction.occurredAt} < now() - interval '7 days')`,
          })
          .from(interaction)
          .where(and(eq(interaction.organizationId, activeOrgId), isNull(interaction.deletedAt)))
          .then((r) => r[0]),
      ]);

      const byStatus = dealRows.map((r) => ({
        status: r.status,
        total: Number(r.total),
        count: r.count,
      }));
      const open = byStatus.find((r) => r.status === "open");
      pipeline = {
        byStatus,
        openValue: open?.total ?? 0,
        openCount: open?.count ?? 0,
      };

      const n = (v: string | undefined) => Number(v ?? 0);
      crm = {
        pipelineOpenValue: open?.total ?? 0,
        pipelineOpenCount: open?.count ?? 0,
        quotesOpen: n(quoteRow?.openCount),
        quotesOpenValue: n(quoteRow?.openValue),
        quotesAwaitingReply: n(quoteRow?.awaitingReply),
        quotesAcceptedValue: n(quoteRow?.acceptedValue),
        ordersOpen: n(orderRow?.openCount),
        ordersOpenValue: n(orderRow?.openValue),
        ordersFulfilledValue: n(orderRow?.fulfilledValue),
        contractsActive: n(contractRow?.activeCount),
        contractsValue: n(contractRow?.activeValue),
        contractsExpiringSoon: n(contractRow?.expiringSoon),
        interactionsThisWeek: n(activityRow?.thisWeek),
        interactionsPrevWeek: n(activityRow?.prevWeek),
      };
    }

    return NextResponse.json({
      stats: {
        savedCompanies: savedCompanyCount,
        savedSearches: savedSearchCount,
        activeTriggers: activeTriggerCount,
        activeTasks: activeTaskCount,
      },
      weeklyActivity,
      recentCompanies: recentCompanies.slice(0, 8),
      ...(pipeline ? { pipeline } : {}),
      ...(crm ? { crm } : {}),
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
