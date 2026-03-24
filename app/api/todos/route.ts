import { NextRequest, NextResponse } from "next/server";
import { eq, asc, desc } from "drizzle-orm";
import { todo, company } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";
import { getCompanyByVat } from "@/lib/cvr-api";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = cacheKey.todos(session.user.id);

    // Check Redis cache first
    const cached = await cacheGet<{ todos: unknown[] }>(key);
    if (cached) {
      return NextResponse.json(cached);
    }

    const todos = await db.query.todo.findMany({
      where: eq(todo.userId, session.user.id),
      with: { company: true },
      orderBy: [asc(todo.isCompleted), desc(todo.createdAt)],
    });

    const result = { todos };
    await cacheSet(key, result, CACHE_TTL.todos);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch todos:", error);
    return NextResponse.json(
      { error: "Failed to fetch todos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, priority, companyId, cvr, dueDate } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Resolve companyId from CVR if provided
    let resolvedCompanyId: string | null = companyId ?? null;

    if (!resolvedCompanyId && cvr && typeof cvr === "string" && cvr.trim()) {
      const trimmedCvr = cvr.trim();

      // Check local DB first
      const existing = await db.query.company.findFirst({
        where: eq(company.vat, trimmedCvr),
        columns: { id: true },
      });

      if (existing) {
        resolvedCompanyId = existing.id;
      } else {
        // Fetch from external CVR API and upsert locally
        try {
          const cvrData = await getCompanyByVat(Number(trimmedCvr));
          const [newCompany] = await db
            .insert(company)
            .values({
              vat: String(cvrData.vat),
              name: cvrData.life?.name || `CVR ${trimmedCvr}`,
              rawData: cvrData,
              address: cvrData.address?.street || null,
              zipcode: cvrData.address?.zipcode ? String(cvrData.address.zipcode) : null,
              city: cvrData.address?.cityname || null,
              municipality: cvrData.address?.municipalityname || null,
              phone: cvrData.contact?.phone || null,
              email: cvrData.contact?.email || null,
              website: cvrData.contact?.www || null,
              industryCode: cvrData.industry?.primary?.code ? String(cvrData.industry.primary.code) : null,
              industryName: cvrData.industry?.primary?.text || null,
              companyType: cvrData.companyform?.description || null,
              companyStatus: cvrData.companystatus?.text || null,
              founded: cvrData.life?.start || null,
              employees: cvrData.employment?.months?.[0]?.amount ?? null,
            })
            .onConflictDoUpdate({
              target: company.vat,
              set: { lastFetchedAt: new Date() },
            })
            .returning();
          resolvedCompanyId = newCompany.id;
        } catch (e) {
          console.warn("Could not fetch company from CVR API:", e);
        }
      }
    }

    const [newTodo] = await db
      .insert(todo)
      .values({
        userId: session.user.id,
        title: title.trim(),
        description: description ?? null,
        priority: priority ?? "medium",
        companyId: resolvedCompanyId,
        dueDate: dueDate ?? null,
      })
      .returning();

    // Re-fetch with company relation
    const todoWithCompany = await db.query.todo.findFirst({
      where: eq(todo.id, newTodo.id),
      with: { company: true },
    });

    // Invalidate cache
    await cacheDel(cacheKey.todos(session.user.id));

    return NextResponse.json({ todo: todoWithCompany }, { status: 201 });
  } catch (error) {
    console.error("Failed to create todo:", error);
    return NextResponse.json(
      { error: "Failed to create todo" },
      { status: 500 }
    );
  }
}
