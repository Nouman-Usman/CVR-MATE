import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { archiveSession, getSessionRow, loadHistory } from "@/lib/agent/persistence";

/** Return a thread (metadata + full transcript) if the caller owns it. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await getSessionRow(id);
  if (!row || row.userId !== session.user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const messages = await loadHistory(id);
  return NextResponse.json({
    session: {
      id: row.id,
      title: row.title,
      locale: row.locale,
      status: row.status,
      pendingInterrupt: row.pendingInterrupt,
    },
    messages,
  });
}

/** Soft-archive a thread (status = 'archived'). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await getSessionRow(id);
  if (!row || row.userId !== session.user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  await archiveSession(id);
  return NextResponse.json({ archived: true });
}
