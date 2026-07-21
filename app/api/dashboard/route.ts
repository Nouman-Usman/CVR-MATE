import { NextResponse } from "next/server";
import { eq, and, count, gte, desc } from "drizzle-orm";
import {
  savedCompany,
  savedSearch,
  leadTrigger,
  triggerResult,
  todo,
} from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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

    return NextResponse.json({
      stats: {
        savedCompanies: savedCompanyCount,
        savedSearches: savedSearchCount,
        activeTriggers: activeTriggerCount,
        activeTasks: activeTaskCount,
      },
      weeklyActivity,
      recentCompanies: recentCompanies.slice(0, 8),
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
