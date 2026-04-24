import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import { getTeamSession, unauthorized } from "@/lib/team/session";

export async function GET(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const userRecord = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  const language = (userRecord?.language as "en" | "da") || "en";
  return NextResponse.json({ language });
}

export async function PATCH(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { language } = body as { language?: string };

  if (!language || !["en", "da"].includes(language)) {
    return NextResponse.json(
      { error: "Language must be 'en' or 'da'" },
      { status: 400 }
    );
  }

  await db
    .update(user)
    .set({ language: language as "en" | "da" })
    .where(eq(user.id, session.user.id));

  return NextResponse.json({ ok: true, language });
}
