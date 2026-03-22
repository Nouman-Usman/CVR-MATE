import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "@/lib/cvr-api";

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get("days") || "30");
    const safeDays = Math.min(Math.max(days, 1), 365);

    const fromDate = new Date(
      Date.now() - safeDays * 24 * 60 * 60 * 1000
    );
    const fromStr = fromDate.toISOString().split("T")[0];

    const results = await searchCompanies({
      life_start: fromStr,
      companystatus_code: "20",
    });

    const companies = Array.isArray(results) ? results : [];

    // Sort newest first
    companies.sort((a, b) => {
      const da = a.life?.start || "";
      const db = b.life?.start || "";
      return db.localeCompare(da);
    });

    // Deduplicate by VAT
    const seen = new Set<number>();
    const unique = companies.filter((c) => {
      if (seen.has(c.vat)) return false;
      seen.add(c.vat);
      return true;
    });

    return NextResponse.json({
      results: unique,
      count: unique.length,
      from: fromStr,
    });
  } catch (error) {
    console.error("CVR recent error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch recent companies";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
