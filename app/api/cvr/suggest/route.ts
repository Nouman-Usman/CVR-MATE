import { NextRequest, NextResponse } from "next/server";
import { suggestCompanies } from "@/lib/cvr-api";

export async function GET(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get("q");

    if (!name || name.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await suggestCompanies(name);

    return NextResponse.json({
      results: Array.isArray(results) ? results : [],
    });
  } catch (error) {
    console.error("CVR suggest error:", error);
    return NextResponse.json({ results: [] });
  }
}
