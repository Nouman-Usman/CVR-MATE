import { NextRequest, NextResponse } from "next/server";
import { getCompanyByVat } from "@/lib/cvr-api";

export async function GET(req: NextRequest) {
  try {
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
