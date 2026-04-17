import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { todo, company } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cacheDel } from "@/lib/redis";
import { cacheKey } from "@/lib/cache";
import { getCompanyByVat } from "@/lib/cvr-api";
import {
  assertCanMutateResource,
  validateActiveOrg,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";

/**
 * Find a todo by ID that the user can access (personal or team-scoped).
 */
async function findAccessibleTodo(id: string, userId: string) {
  const t = await db.query.todo.findFirst({
    where: eq(todo.id, id),
  });
  if (!t) return null;

  // Personal todo — must be the owner
  if (!t.organizationId) {
    return t.userId === userId ? t : null;
  }

  // Team todo — caller will check with assertCanMutateResource
  return t;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await findAccessibleTodo(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    // Resource-level auth
    try {
      await assertCanMutateResource(session.user.id, {
        userId: existing.userId,
        organizationId: existing.organizationId,
      });
    } catch (err) {
      if (err instanceof TeamPermissionError) {
        return NextResponse.json({ error: err.message }, { status: teamErrorToStatus(err) });
      }
      throw err;
    }

    const { title, description, isCompleted, priority, companyId, cvr, dueDate } =
      body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    // Resolve company: direct companyId takes priority, then CVR lookup
    if (companyId !== undefined) {
      updateData.companyId = companyId;
    } else if (cvr !== undefined) {
      if (cvr === null || cvr === "") {
        updateData.companyId = null;
      } else {
        const trimmedCvr = cvr.trim();
        const existingCompany = await db.query.company.findFirst({
          where: eq(company.vat, trimmedCvr),
          columns: { id: true },
        });
        if (existingCompany) {
          updateData.companyId = existingCompany.id;
        } else {
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
            updateData.companyId = newCompany.id;
          } catch (e) {
            console.warn("Could not fetch company from CVR API:", e);
          }
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(todo)
      .set(updateData)
      .where(eq(todo.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    // Re-fetch with company relation
    const todoWithCompany = await db.query.todo.findFirst({
      where: eq(todo.id, updated.id),
      with: { company: true },
    });

    // Invalidate cache
    const activeOrgId = await validateActiveOrg(
      session.user.id,
      session.session?.activeOrganizationId
    );
    await cacheDel(cacheKey.todos(session.user.id));
    if (activeOrgId) {
      await cacheDel(`${cacheKey.todos(session.user.id)}:org:${activeOrgId}`);
    }

    return NextResponse.json({ todo: todoWithCompany });
  } catch (error) {
    console.error("Failed to update todo:", error);
    return NextResponse.json(
      { error: "Failed to update todo" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await findAccessibleTodo(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    // Resource-level auth
    try {
      await assertCanMutateResource(session.user.id, {
        userId: existing.userId,
        organizationId: existing.organizationId,
      });
    } catch (err) {
      if (err instanceof TeamPermissionError) {
        return NextResponse.json({ error: err.message }, { status: teamErrorToStatus(err) });
      }
      throw err;
    }

    await db.delete(todo).where(eq(todo.id, id));

    // Invalidate cache
    const activeOrgId = await validateActiveOrg(
      session.user.id,
      session.session?.activeOrganizationId
    );
    await cacheDel(cacheKey.todos(session.user.id));
    if (activeOrgId) {
      await cacheDel(`${cacheKey.todos(session.user.id)}:org:${activeOrgId}`);
    }

    return NextResponse.json({ message: "Todo deleted" });
  } catch (error) {
    console.error("Failed to delete todo:", error);
    return NextResponse.json(
      { error: "Failed to delete todo" },
      { status: 500 }
    );
  }
}
