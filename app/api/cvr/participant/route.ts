import { NextRequest, NextResponse } from "next/server";
import {
  getParticipantByNumber,
  getCompanyByVat,
  type CvrParticipant,
  type CvrParticipation,
} from "@/lib/cvr-api";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const fromVat = req.nextUrl.searchParams.get("fromVat"); // originating company

    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Valid participant number is required" },
        { status: 400 }
      );
    }

    // 1. Fetch participant personal data from CVR API
    const participantRaw = await getParticipantByNumber(Number(id));

    // 2. Get company relations (participations) from the originating company
    let companies: CvrParticipation[] = [];

    if (fromVat && /^\d{8}$/.test(fromVat)) {
      const company = await getCompanyByVat(Number(fromVat));
      const raw = company as unknown as Record<string, unknown>;

      // The company schema has participations[] — companies where participants are involved.
      // We also check participants[] to find this person's roles in the current company.
      const participations = (raw.participations ?? []) as CvrParticipation[];
      if (participations.length > 0) {
        companies = participations;
      }

      // Also add the originating company itself with this participant's roles
      const participants = (raw.participants ?? []) as {
        participantnumber?: number;
        vat?: number;
        roles: CvrParticipation["roles"];
      }[];
      const thisParticipant = participants.find(
        (p) => p.participantnumber === Number(id)
      );

      if (thisParticipant) {
        // Check if the originating company is already in participations
        const alreadyIncluded = companies.some(
          (c) => c.vat === Number(fromVat)
        );
        if (!alreadyIncluded) {
          companies.unshift({
            vat: company.vat,
            slug: company.slug,
            companyform: company.companyform,
            companystatus: company.companystatus,
            life: company.life,
            roles: thisParticipant.roles,
          });
        }
      }
    }

    const participant: CvrParticipant = {
      ...participantRaw,
      companies,
    };

    return NextResponse.json({ participant });
  } catch (error) {
    console.error("CVR participant lookup error:", error);
    const message =
      error instanceof Error ? error.message : "Participant lookup failed";
    const status = message.includes("404") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
