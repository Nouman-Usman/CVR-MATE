import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import { getCompanyByVat } from "@/lib/cvr-api";
import { maskCompanyForPreview } from "@/lib/chat-landing/masking";

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(ip, "chat-landing-preview", 5, 3600, { failClosed: true });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const vatParam = req.nextUrl.searchParams.get("vat");
    const vat = vatParam ? Number(vatParam) : NaN;
    if (!vatParam || Number.isNaN(vat)) {
      return NextResponse.json({ error: "vat query param is required" }, { status: 400 });
    }

    const company = await getCompanyByVat(vat);
    return NextResponse.json({ preview: maskCompanyForPreview(company) });
  } catch (error) {
    console.error("chat-landing preview error:", error);
    return NextResponse.json({ error: "Failed to fetch preview" }, { status: 500 });
  }
}
