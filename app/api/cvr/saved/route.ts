import { NextRequest, NextResponse } from "next/server";
import { eq, and, count, or, isNull, sql } from "drizzle-orm";
import { company, savedCompany } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { checkUsageEntitlement } from "@/lib/stripe/entitlements";
import { validateActiveOrg } from "@/lib/team/permissions";
import { getCompanyByVat } from "@/lib/cvr-api";
import type { CvrCompany } from "@/lib/cvr-api";

// GET /api/cvr/saved — list saved companies for the current user + organization
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrgId = await validateActiveOrg(
      session.user.id,
      session.session?.activeOrganizationId
    );

    const saved = await db.query.savedCompany.findMany({
      where: or(
        and(eq(savedCompany.userId, session.user.id), isNull(savedCompany.organizationId)),
        activeOrgId ? eq(savedCompany.organizationId, activeOrgId) : sql`false`
      ),
      with: { company: true },
      orderBy: (sc, { desc }) => [desc(sc.createdAt)],
    });

    return NextResponse.json({
      results: saved.map((s) => ({
        id: s.id,
        cvr: s.cvr,
        note: s.note,
        tags: (s.tags ?? []) as string[],
        savedAt: s.createdAt,
        company: s.company,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch saved companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved companies" },
      { status: 500 }
    );
  }
}

// POST /api/cvr/saved — save a company (personal or to active org)
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrgId = await validateActiveOrg(
      session.user.id,
      session.session?.activeOrganizationId
    );

    // Check saved companies limit
    const [{ value: savedCount }] = await db
      .select({ value: count() })
      .from(savedCompany)
      .where(eq(savedCompany.userId, session.user.id));

    const { allowed, limit } = await checkUsageEntitlement(
      session.user.id,
      "savedCompanies",
      savedCount
    );
    if (!allowed) {
      return NextResponse.json(
        { error: `Saved companies limit reached (${limit}). Upgrade your plan for more.`, upgrade: true },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { vat, note } = body;

    // VAT validation — same guard used in 6 other CVR routes
    if (!vat || !/^\d{8}$/.test(String(vat))) {
      return NextResponse.json(
        { error: "Invalid VAT format" },
        { status: 400 }
      );
    }

    // Fetch canonical data server-side — never trust rawData from client
    let cvrData: CvrCompany;
    try {
      cvrData = await getCompanyByVat(Number(vat));
    } catch {
      return NextResponse.json(
        { error: "Company not found in CVR registry" },
        { status: 404 }
      );
    }

    const sanitizedNote = typeof note === "string" ? note.trim() || null : null;

    // Upsert company record
    const existing = await db.query.company.findFirst({
      where: eq(company.vat, String(vat)),
    });

    let companyId: string;
    if (existing) {
      companyId = existing.id;
      // Update with canonical CVR data
      await db
        .update(company)
        .set({
          rawData: cvrData,
          name: cvrData.life?.name || existing.name,
          city: cvrData.address?.cityname || existing.city,
          zipcode: cvrData.address?.zipcode
            ? String(cvrData.address.zipcode)
            : existing.zipcode,
          address: cvrData.address?.street || existing.address,
          municipality: cvrData.address?.municipalityname || existing.municipality,
          industryCode: cvrData.industry?.primary?.code
            ? String(cvrData.industry.primary.code)
            : existing.industryCode,
          industryName: cvrData.industry?.primary?.text || existing.industryName,
          companyType: cvrData.companyform?.description || existing.companyType,
          companyStatus: cvrData.companystatus?.text || existing.companyStatus,
          founded: cvrData.life?.start || existing.founded,
          employees: cvrData.employment?.months?.[0]?.amount ?? existing.employees,
          lastFetchedAt: new Date(),
        })
        .where(eq(company.id, existing.id));
    } else {
      const [newCompany] = await db
        .insert(company)
        .values({
          vat: String(vat),
          name: cvrData.life?.name || "Unknown",
          rawData: cvrData,
          city: cvrData.address?.cityname || null,
          zipcode: cvrData.address?.zipcode
            ? String(cvrData.address.zipcode)
            : null,
          address: cvrData.address?.street || null,
          municipality: cvrData.address?.municipalityname || null,
          industryCode: cvrData.industry?.primary?.code
            ? String(cvrData.industry.primary.code)
            : null,
          industryName: cvrData.industry?.primary?.text || null,
          companyType: cvrData.companyform?.description || null,
          companyStatus: cvrData.companystatus?.text || null,
          founded: cvrData.life?.start || null,
          employees: cvrData.employment?.months?.[0]?.amount ?? null,
        })
        .returning();
      companyId = newCompany.id;
    }

    // Check if already saved (in same scope: personal or org)
    const alreadySaved = await db.query.savedCompany.findFirst({
      where: and(
        eq(savedCompany.userId, session.user.id),
        eq(savedCompany.cvr, String(vat)),
        activeOrgId ? eq(savedCompany.organizationId, activeOrgId) : isNull(savedCompany.organizationId)
      ),
    });

    if (alreadySaved) {
      return NextResponse.json({ saved: true, alreadyExists: true });
    }

    await db.insert(savedCompany).values({
      userId: session.user.id,
      organizationId: activeOrgId ?? null,
      companyId,
      cvr: String(vat),
      note: sanitizedNote,
    });

    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to save company:", error);
    return NextResponse.json(
      { error: "Failed to save company" },
      { status: 500 }
    );
  }
}

// PATCH /api/cvr/saved — update note or tags on a saved company
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { cvr } = body;

    if (!cvr) {
      return NextResponse.json(
        { error: "cvr is required" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.note !== undefined) {
      updates.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    }

    if (body.tags !== undefined) {
      const tags = Array.isArray(body.tags)
        ? [...new Set(
            body.tags
              .map((t: unknown) => String(t).trim().slice(0, 30))
              .filter(Boolean)
          )].slice(0, 10)
        : [];
      updates.tags = tags;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db
      .update(savedCompany)
      .set(updates)
      .where(
        and(
          eq(savedCompany.userId, session.user.id),
          eq(savedCompany.cvr, String(cvr))
        )
      );

    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Failed to update saved company:", error);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}

// DELETE /api/cvr/saved — remove a saved company
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cvr = req.nextUrl.searchParams.get("cvr");
    if (!cvr) {
      return NextResponse.json(
        { error: "cvr parameter is required" },
        { status: 400 }
      );
    }

    await db
      .delete(savedCompany)
      .where(
        and(
          eq(savedCompany.userId, session.user.id),
          eq(savedCompany.cvr, cvr)
        )
      );

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("Failed to remove saved company:", error);
    return NextResponse.json(
      { error: "Failed to remove saved company" },
      { status: 500 }
    );
  }
}
