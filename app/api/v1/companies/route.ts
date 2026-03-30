import { NextRequest } from "next/server";
import { db } from "@/db";
import { savedCompany, company, companyWorkspace } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { validateApiKey, requireScope, handleApiKeyError } from "@/lib/api-key-auth";

// GET /api/v1/companies — list saved companies for the org
export async function GET(request: NextRequest) {
  try {
    const ctx = await validateApiKey(request.headers.get("authorization"));
    requireScope(ctx, "read");

    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0"));

    const companies = await db
      .select({
        id: savedCompany.id,
        cvr: savedCompany.cvr,
        note: savedCompany.note,
        savedAt: savedCompany.createdAt,
        companyName: company.name,
        address: company.address,
        city: company.city,
        industry: company.industryName,
        employees: company.employees,
        phone: company.phone,
        email: company.email,
        website: company.website,
      })
      .from(savedCompany)
      .innerJoin(company, eq(savedCompany.companyId, company.id))
      .where(
        and(
          eq(savedCompany.organizationId, ctx.organizationId),
          isNull(savedCompany.deletedAt)
        )
      )
      .orderBy(desc(savedCompany.createdAt))
      .limit(limit)
      .offset(offset);

    return Response.json({ companies, limit, offset });
  } catch (error) {
    return handleApiKeyError(error);
  }
}

// POST /api/v1/companies — save a company to the org workspace
export async function POST(request: NextRequest) {
  try {
    const ctx = await validateApiKey(request.headers.get("authorization"));
    requireScope(ctx, "write");

    const body = await request.json();
    const { cvr, status, tags, source } = body as {
      cvr: string;
      status?: string;
      tags?: string[];
      source?: string;
    };

    if (!cvr) {
      return Response.json({ error: "cvr is required" }, { status: 400 });
    }

    // Find the company in our cache
    const existingCompany = await db.query.company.findFirst({
      where: eq(company.vat, cvr),
    });

    if (!existingCompany) {
      return Response.json(
        { error: "Company not found. Search for it first via /api/v1/search." },
        { status: 404 }
      );
    }

    // Upsert into workspace
    const [workspace] = await db
      .insert(companyWorkspace)
      .values({
        organizationId: ctx.organizationId,
        companyId: existingCompany.id,
        status: status ?? "prospect",
        tags: tags ?? [],
        source: source ?? "api",
      })
      .onConflictDoNothing()
      .returning();

    return Response.json({ workspace: workspace ?? { message: "Already exists" } }, { status: 201 });
  } catch (error) {
    return handleApiKeyError(error);
  }
}
