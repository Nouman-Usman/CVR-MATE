import { NextRequest, NextResponse } from "next/server";
import {
  getParticipantByNumber,
  getCompanyByVat,
  extractParticipantFromCompany,
  normalizeRoles,
  type CvrParticipant,
  type CvrParticipation,
} from "@/lib/cvr-api";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const fromVat = req.nextUrl.searchParams.get("fromVat");

    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Valid participant number is required" },
        { status: 400 }
      );
    }

    const participantNumber = Number(id);

    // 1. Fetch participant data from CVR API
    //    Despite the official docs only documenting personal info, the API
    //    actually returns the participant's full list of company affiliations
    //    in the `roles` field (each entry is a CvrParticipation). The
    //    `participations` alias is checked as a future-proof fallback.
    const participantRaw = await getParticipantByNumber(participantNumber);

    let companies: CvrParticipation[] = [];

    const sourceList: CvrParticipation[] | undefined =
      (Array.isArray(participantRaw.roles) && participantRaw.roles.length > 0
        ? participantRaw.roles
        : undefined) ??
      (Array.isArray(participantRaw.participations) &&
      participantRaw.participations.length > 0
        ? participantRaw.participations
        : undefined);

    if (sourceList) {
      companies = sourceList.map((p) => ({
        ...p,
        roles: normalizeRoles(p.roles),
      }));
    }

    // 2. Fallback: if the participant endpoint didn't return company data,
    //    extract from the originating company's participants[] array.
    //    This only yields the originating company, but it's better than nothing.
    if (companies.length === 0 && fromVat && /^\d{8}$/.test(fromVat)) {
      const company = await getCompanyByVat(Number(fromVat));
      const companyEntry = extractParticipantFromCompany(
        company,
        participantNumber
      );
      if (companyEntry) {
        companies.push(companyEntry);
      }
    }

    // 3. Deduplicate by VAT
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
