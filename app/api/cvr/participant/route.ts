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

    // 1. Fetch participant data from CVR API — may include participations[]
    const participantRaw = await getParticipantByNumber(Number(id));

    // 2. Extract participations directly from the participant response (source of truth)
    let companies: CvrParticipation[] = participantRaw.participations ?? [];

    // 3. If participant endpoint didn't return participations, fall back to originating company
    if (companies.length === 0 && fromVat && /^\d{8}$/.test(fromVat)) {
      const company = await getCompanyByVat(Number(fromVat));
      const raw = company as unknown as Record<string, unknown>;

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

    // 4. Deduplicate companies by VAT (participant endpoint + originating company may overlap)
    const seen = new Set<number>();
    companies = companies.filter((c) => {
      if (seen.has(c.vat)) return false;
      seen.add(c.vat);
      return true;
    });

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
