import { NextRequest, NextResponse } from "next/server";
import { eq, asc, desc, count, or, and, isNull, sql } from "drizzle-orm";
import { todo, company } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { cacheKey, CACHE_TTL } from "@/lib/cache";
import { getCompanyByVat } from "@/lib/cvr-api";
import { checkUsageEntitlement } from "@/lib/stripe/entitlements";
import { getOrgMembership } from "@/lib/team/permissions";
import { resolveWorkspaceForUser } from "@/lib/workspace/resolve";
import { workspaceScope } from "@/lib/workspace/scope";
import { orgIdForWrite, workspaceKey } from "@/lib/workspace/types";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await resolveWorkspaceForUser(
      session.user.id,
      session.session?.activeOrganizationId
    );

    // Keyed by workspace so switching cannot serve the previous one's cache.
    const key = `${cacheKey.todos(session.user.id)}:${workspaceKey(workspace)}`;

    // Check Redis cache first
    const cached = await cacheGet<{ todos: unknown[] }>(key);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Exactly one workspace. Personal and team tasks used to arrive merged,
    // so a private reminder and a task a colleague could see sat in one list.
    const todos = await db.query.todo.findMany({
      where: workspaceScope(workspace, {
        userId: todo.userId,
        organizationId: todo.organizationId,
      }),
      with: {
        company: true,
        assignedUser: { columns: { id: true, name: true, image: true } },
      },
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

    // Check task limit (only personal tasks count against quota)
    const [{ value: taskCount }] = await db
      .select({ value: count() })
      .from(todo)
      .where(and(eq(todo.userId, session.user.id), isNull(todo.organizationId)));

    const { allowed, limit } = await checkUsageEntitlement(session.user.id, "tasks", taskCount);

    const body = await req.json();
    const { title, description, priority, companyId, cvr, dueDate, scope, assignedUserId } = body;

    const workspace = await resolveWorkspaceForUser(
      session.user.id,
      session.session?.activeOrganizationId
    );
    // `scope: "personal"` still forces a private task while inside an org —
    // the workspace decides the default, the caller can opt out of sharing.
    const organizationId = scope === "personal" ? null : orgIdForWrite(workspace);

    // Validate assignment: only admin/owner can assign to other members
    let resolvedAssignedUserId: string | null = null;
    if (assignedUserId) {
      if (assignedUserId !== session.user.id) {
        // Assigning to someone else — requires admin/owner role
        if (!organizationId) {
          return NextResponse.json(
            { error: "Cannot assign personal tasks to other members" },
            { status: 403 }
          );
        }
        const membership = await getOrgMembership(session.user.id, organizationId);
        if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
          return NextResponse.json(
            { error: "Only admins and owners can assign tasks to other members" },
            { status: 403 }
          );
        }
      }
      resolvedAssignedUserId = assignedUserId;
    }

    // Personal tasks check plan limits; team tasks don't count against personal quota
    if (!organizationId && !allowed) {
      return NextResponse.json(
        { error: `Task limit reached (${limit}). Upgrade your plan for more.`, upgrade: true },
        { status: 403 }
      );
    }

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
        organizationId,
        title: title.trim(),
        description: description ?? null,
        priority: priority ?? "medium",
        companyId: resolvedCompanyId,
        assignedUserId: resolvedAssignedUserId,
        dueDate: dueDate ?? null,
      })
      .returning();

    // Re-fetch with company and assignedUser relations
    const todoWithCompany = await db.query.todo.findFirst({
      where: eq(todo.id, newTodo.id),
      with: {
        company: true,
        assignedUser: { columns: { id: true, name: true, image: true } },
      },
    });

    // Invalidate the workspace the task landed in. A `scope: "personal"` task
    // created from inside an org belongs to the personal cache, not the org's,
    // so the key is derived from where it was written rather than from where
    // the user happens to be standing.
    await cacheDel(
      `${cacheKey.todos(session.user.id)}:${
        organizationId ? `org:${organizationId}` : "personal"
      }`
    );

    return NextResponse.json({ todo: todoWithCompany }, { status: 201 });
  } catch (error) {
    console.error("Failed to create todo:", error);
    return NextResponse.json(
      { error: "Failed to create todo" },
      { status: 500 }
    );
  }
}
