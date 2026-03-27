import { NextRequest, NextResponse } from "next/server";
import { getParticipantByNumber } from "@/lib/cvr-api";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Valid participant number is required" },
        { status: 400 }
      );
    }

    const participant = await getParticipantByNumber(Number(id));

    return NextResponse.json({ participant });
  } catch (error) {
    console.error("CVR participant lookup error:", error);
    const message =
      error instanceof Error ? error.message : "Participant lookup failed";
    const status = message.includes("404") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
