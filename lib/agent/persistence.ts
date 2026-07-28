import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { agentSession, agentMessage } from "@/db/schema";
import type { AgentLocale, PendingInterrupt, StoredMessage, StoredRole } from "./types";

export interface AgentSessionRow {
  id: string;
  userId: string;
  organizationId: string | null;
  title: string | null;
  locale: AgentLocale;
  status: string;
  pendingInterrupt: PendingInterrupt | null;
}

function toSessionRow(row: typeof agentSession.$inferSelect): AgentSessionRow {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    title: row.title,
    locale: row.locale === "en" ? "en" : "da",
    status: row.status,
    pendingInterrupt: (row.pendingInterrupt as PendingInterrupt | null) ?? null,
  };
}

export async function createSession(opts: {
  userId: string;
  organizationId: string | null;
  locale: AgentLocale;
  title?: string | null;
}): Promise<string> {
  const [row] = await db
    .insert(agentSession)
    .values({
      userId: opts.userId,
      organizationId: opts.organizationId,
      locale: opts.locale,
      title: opts.title ?? null,
    })
    .returning({ id: agentSession.id });
  return row.id;
}

export async function getSessionRow(sessionId: string): Promise<AgentSessionRow | null> {
  const row = await db.query.agentSession.findFirst({ where: eq(agentSession.id, sessionId) });
  return row ? toSessionRow(row) : null;
}

export async function loadHistory(sessionId: string): Promise<StoredMessage[]> {
  const rows = await db.query.agentMessage.findMany({
    where: eq(agentMessage.sessionId, sessionId),
    orderBy: asc(agentMessage.createdAt),
  });
  return rows.map((r) => ({
    role: r.role as StoredRole,
    content: (r.content as Anthropic.ContentBlockParam[]) ?? [],
  }));
}

export async function appendMessage(
  sessionId: string,
  role: StoredRole,
  content: Anthropic.ContentBlockParam[]
): Promise<void> {
  await db.insert(agentMessage).values({ sessionId, role, content });
}

/** Update the pending-interrupt payload and session status atomically. */
export async function setInterrupt(
  sessionId: string,
  pending: PendingInterrupt | null,
  status: "active" | "awaiting_confirmation"
): Promise<void> {
  await db
    .update(agentSession)
    .set({ pendingInterrupt: pending, status })
    .where(eq(agentSession.id, sessionId));
}

export async function touchSession(sessionId: string, title?: string | null): Promise<void> {
  const set: Partial<typeof agentSession.$inferInsert> = { updatedAt: new Date() };
  if (title != null) set.title = title;
  await db.update(agentSession).set(set).where(eq(agentSession.id, sessionId));
}

export async function archiveSession(sessionId: string): Promise<void> {
  await db.update(agentSession).set({ status: "archived" }).where(eq(agentSession.id, sessionId));
}

export interface SessionListItem {
  id: string;
  title: string | null;
  status: string;
  updatedAt: Date;
}

/** List a user's non-archived threads, personal + active-org scoped, newest first. */
export async function listSessions(
  userId: string,
  organizationId: string | null
): Promise<SessionListItem[]> {
  const scope = organizationId
    ? eq(agentSession.organizationId, organizationId)
    : and(eq(agentSession.userId, userId), isNull(agentSession.organizationId));
  const rows = await db.query.agentSession.findMany({
    where: and(scope, ne(agentSession.status, "archived")),
    orderBy: desc(agentSession.updatedAt),
    limit: 100,
  });
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, updatedAt: r.updatedAt }));
}

/**
 * Rebuild the persisted transcript into an Anthropic messages array.
 * `user` and `tool_result` rows both become **user**-role messages (Anthropic
 * requires tool_result blocks to live in a user turn); `assistant` rows stay
 * assistant. The stored content blocks are used verbatim.
 */
export function rebuildMessages(stored: StoredMessage[]): Anthropic.MessageParam[] {
  return stored.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));
}
