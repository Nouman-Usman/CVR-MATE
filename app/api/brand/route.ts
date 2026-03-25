import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { userBrand } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brand = await db.query.userBrand.findFirst({
      where: eq(userBrand.userId, session.user.id),
    });

    return NextResponse.json({ brand: brand ?? null });
  } catch (error) {
    console.error("Failed to fetch brand:", error);
    return NextResponse.json(
      { error: "Failed to fetch brand" },
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
    const {
      companyName,
      cvr,
      industry,
      industryCode,
      companySize,
      employees,
      website,
      products,
      targetAudience,
      tone,
    } = body;

    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }
    if (!products || typeof products !== "string" || !products.trim()) {
      return NextResponse.json(
        { error: "Products/services description is required" },
        { status: 400 }
      );
    }

    // Check if brand already exists (upsert)
    const existing = await db.query.userBrand.findFirst({
      where: eq(userBrand.userId, session.user.id),
      columns: { id: true },
    });

    if (existing) {
      const [updated] = await db
        .update(userBrand)
        .set({
          companyName: companyName.trim(),
          cvr: cvr?.trim() || null,
          industry: industry?.trim() || null,
          industryCode: industryCode?.trim() || null,
          companySize: companySize || null,
          employees: employees ? Number(employees) : null,
          website: website?.trim() || null,
          products: products.trim(),
          targetAudience: targetAudience?.trim() || null,
          tone: tone || "formal",
        })
        .where(eq(userBrand.id, existing.id))
        .returning();
      return NextResponse.json({ brand: updated });
    }

    const [brand] = await db
      .insert(userBrand)
      .values({
        userId: session.user.id,
        companyName: companyName.trim(),
        cvr: cvr?.trim() || null,
        industry: industry?.trim() || null,
        industryCode: industryCode?.trim() || null,
        companySize: companySize || null,
        employees: employees ? Number(employees) : null,
        website: website?.trim() || null,
        products: products.trim(),
        targetAudience: targetAudience?.trim() || null,
        tone: tone || "formal",
      })
      .returning();

    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    console.error("Failed to save brand:", error);
    return NextResponse.json(
      { error: "Failed to save brand" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const existing = await db.query.userBrand.findFirst({
      where: eq(userBrand.userId, session.user.id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "No brand profile found. Use POST to create one." },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.companyName !== undefined) updates.companyName = body.companyName.trim();
    if (body.cvr !== undefined) updates.cvr = body.cvr?.trim() || null;
    if (body.industry !== undefined) updates.industry = body.industry?.trim() || null;
    if (body.industryCode !== undefined) updates.industryCode = body.industryCode?.trim() || null;
    if (body.companySize !== undefined) updates.companySize = body.companySize || null;
    if (body.employees !== undefined) updates.employees = body.employees ? Number(body.employees) : null;
    if (body.website !== undefined) updates.website = body.website?.trim() || null;
    if (body.products !== undefined) updates.products = body.products.trim();
    if (body.targetAudience !== undefined) updates.targetAudience = body.targetAudience?.trim() || null;
    if (body.tone !== undefined) updates.tone = body.tone || "formal";

    const [updated] = await db
      .update(userBrand)
      .set(updates)
      .where(eq(userBrand.id, existing.id))
      .returning();

    return NextResponse.json({ brand: updated });
  } catch (error) {
    console.error("Failed to update brand:", error);
    return NextResponse.json(
      { error: "Failed to update brand" },
      { status: 500 }
    );
  }
}
