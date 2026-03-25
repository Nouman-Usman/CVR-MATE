import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompanyByVat } from "@/lib/cvr-api";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vat } = await req.json();

    if (!vat || !/^\d{8}$/.test(String(vat))) {
      return NextResponse.json(
        { error: "Valid 8-digit CVR number is required" },
        { status: 400 }
      );
    }

    const company = await getCompanyByVat(Number(vat));

    const employees =
      company.employment?.years?.[0]?.amount ??
      company.accounting?.documents?.[0]?.summary?.averagenumberofemployees ??
      null;

    return NextResponse.json({
      companyName: company.life?.name ?? "",
      industry: company.industry?.primary?.text ?? "",
      industryCode: company.industry?.primary?.code
        ? String(company.industry.primary.code)
        : "",
      employees: employees ? Number(employees) : null,
      website: company.contact?.www ?? "",
    });
  } catch (error) {
    console.error("CVR lookup error:", error);
    return NextResponse.json(
      { error: "Company not found or CVR API unavailable" },
      { status: 404 }
    );
  }
}
