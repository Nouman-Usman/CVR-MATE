import { NextRequest, NextResponse } from "next/server";
import { getCompanyByVat } from "@/lib/cvr-api";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(session.user.id, "cvr_company_lookup", 60, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Maximum 60 company lookups per minute." },
        { status: 429 }
      );
    }

    const vat = req.nextUrl.searchParams.get("vat");

    if (!vat || !/^\d{8}$/.test(vat)) {
      return NextResponse.json(
        { error: "Valid 8-digit CVR number is required" },
        { status: 400 }
      );
    }

    const company = await getCompanyByVat(Number(vat));

    return NextResponse.json({ company });
  } catch (error) {
    console.error("CVR company lookup error:", error);
    const message =
      error instanceof Error ? error.message : "Company lookup failed";
    const status = message.includes("404") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
