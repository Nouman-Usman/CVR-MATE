import { NextRequest, NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { company, savedCompany } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { checkUsageEntitlement } from "@/lib/stripe/entitlements";

// GET /api/cvr/saved — list saved companies for the current user
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const saved = await db.query.savedCompany.findMany({
      where: eq(savedCompany.userId, session.user.id),
      with: { company: true },
      orderBy: (sc, { desc }) => [desc(sc.createdAt)],
    });

    return NextResponse.json({
      results: saved.map((s) => ({
        id: s.id,
        cvr: s.cvr,
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

// POST /api/cvr/saved — save a company
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const { vat, name, rawData } = body;

    if (!vat || !name) {
      return NextResponse.json(
        { error: "vat and name are required" },
        { status: 400 }
      );
    }

    // Upsert company record
    const existing = await db.query.company.findFirst({
      where: eq(company.vat, String(vat)),
    });

    let companyId: string;
    if (existing) {
      companyId = existing.id;
      // Update raw data if provided
      if (rawData) {
        await db
          .update(company)
          .set({
            rawData,
            name: rawData.life?.name || name,
            city: rawData.address?.cityname || existing.city,
            zipcode: rawData.address?.zipcode
              ? String(rawData.address.zipcode)
              : existing.zipcode,
            address: rawData.address?.street || existing.address,
            municipality: rawData.address?.municipalityname || existing.municipality,
            industryCode: rawData.industry?.primary?.code
              ? String(rawData.industry.primary.code)
              : existing.industryCode,
            industryName: rawData.industry?.primary?.text || existing.industryName,
            companyType: rawData.companyform?.description || existing.companyType,
            companyStatus: rawData.companystatus?.text || existing.companyStatus,
            founded: rawData.life?.start || existing.founded,
            employees: rawData.employment?.months?.[0]?.amount ?? existing.employees,
            lastFetchedAt: new Date(),
          })
          .where(eq(company.id, existing.id));
      }
    } else {
      const [newCompany] = await db
        .insert(company)
        .values({
          vat: String(vat),
          name: rawData?.life?.name || name,
          rawData: rawData || {},
          city: rawData?.address?.cityname || null,
          zipcode: rawData?.address?.zipcode
            ? String(rawData.address.zipcode)
            : null,
          address: rawData?.address?.street || null,
          municipality: rawData?.address?.municipalityname || null,
          industryCode: rawData?.industry?.primary?.code
            ? String(rawData.industry.primary.code)
            : null,
          industryName: rawData?.industry?.primary?.text || null,
          companyType: rawData?.companyform?.description || null,
          companyStatus: rawData?.companystatus?.text || null,
          founded: rawData?.life?.start || null,
          employees: rawData?.employment?.months?.[0]?.amount ?? null,
        })
        .returning();
      companyId = newCompany.id;
    }

    // Check if already saved
    const alreadySaved = await db.query.savedCompany.findFirst({
      where: and(
        eq(savedCompany.userId, session.user.id),
        eq(savedCompany.cvr, String(vat))
      ),
    });

    if (alreadySaved) {
      return NextResponse.json({ saved: true, alreadyExists: true });
    }

    await db.insert(savedCompany).values({
      userId: session.user.id,
      companyId,
      cvr: String(vat),
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
