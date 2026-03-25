import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { crmConnection } from "@/db/schema";

// POST /api/integrations/[provider]/disconnect — disconnect CRM
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = await params;

    await db
      .update(crmConnection)
      .set({ isActive: false })
      .where(
        and(
          eq(crmConnection.userId, session.user.id),
          eq(crmConnection.provider, provider)
        )
      );

    return NextResponse.json({ disconnected: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
