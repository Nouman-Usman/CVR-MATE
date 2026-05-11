import { NextRequest, NextResponse } from "next/server";
import { suggestCompanies } from "@/lib/cvr-api";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(session.user.id, "cvr_suggest", 120, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Maximum 120 suggestion requests per minute." },
        { status: 429 }
      );
    }

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
