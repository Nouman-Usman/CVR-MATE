import "server-only";

import { db } from "@/db";
import { notification } from "@/db/schema";
import { member, organization } from "@/db/auth-schema";
import { eq, and, desc, count, inArray, isNull, or, type SQL } from "drizzle-orm";

/**
 * Restrict a notification query to workspaces the user is still part of.
 *
 * Cross-workspace visibility is deliberate — see `getUserNotifications` — but
 * it is scoped to workspaces the user *belongs to*. A notification tagged with
 * an organization they have since left is different in kind: opening it asks
 * the UI to switch into a workspace every query will now reject, so it renders
 * as an item that can be seen but never acted on.
 *
 * Personal notifications (organization_id IS NULL) always pass.
 *
 * Filtered rather than deleted at removal time, so the notification comes back
 * intact if the person is invited again — and so removing a member never
 * destroys anything.
 */
function visibleToUser(userId: string): SQL | undefined {
  return and(
    eq(notification.userId, userId),
    or(
      isNull(notification.organizationId),
      inArray(
        notification.organizationId,
        db
          .select({ organizationId: member.organizationId })
          .from(member)
          .where(eq(member.userId, userId))
      )
    )
  );
}

// ─── In-process pub/sub for SSE fan-out ──────────────────────────────────────
// Each user can have multiple SSE connections (tabs). When a notification is
// created, we publish to all listeners for that user. In a multi-instance
// deployment, replace this with Redis pub/sub for cross-process fan-out.

type Listener = (event: NotificationEvent) => void;

export interface NotificationEvent {
  type: "new" | "read" | "deleted" | "read-all";
  notification?: NotificationRecord;
  id?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  /** Which workspace this is about. Null = personal. */
  organizationId: string | null;
  /** Resolved for display, so the list can label a notification's workspace. */
  organizationName: string | null;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

class NotificationBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(userId: string, listener: Listener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(userId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(userId);
      }
    };
  }

  publish(userId: string, event: NotificationEvent) {
    const set = this.listeners.get(userId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch {
          // Listener errored — ignore (stale connection)
        }
      }
    }
  }
}

// Singleton — survives across API route invocations in the same process
export const notificationBus = new NotificationBus();

// ─── DB helpers ──────────────────────────────────────────────────────────────

export async function createNotification(data: {
  userId: string;
  /**
   * The workspace the notification is about — omit for personal.
   *
   * Required in practice for anything referencing org-only data: a contract
   * renewal or a quote response links to a page the CRM guard will refuse
   * unless the reader is in that organization, so the notification has to carry
   * enough context for the UI to take them there.
   */
  organizationId?: string | null;
  type: "trigger" | "system" | "export" | "person_follow" | "matches" | "annual_report";
  title: string;
  message?: string;
  link?: string;
}): Promise<NotificationRecord> {
  const [row] = await db
    .insert(notification)
    .values({
      userId: data.userId,
      organizationId: data.organizationId ?? null,
      type: data.type,
      title: data.title,
      message: data.message ?? null,
      link: data.link ?? null,
    })
    .returning();

  const orgName = row.organizationId
    ? (
        await db.query.organization.findFirst({
          where: eq(organization.id, row.organizationId),
          columns: { name: true },
        })
      )?.name ?? null
    : null;

  const record: NotificationRecord = {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    organizationName: orgName,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.isRead,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
  };

  // Push to all SSE connections for this user
  notificationBus.publish(data.userId, {
    type: "new",
    notification: record,
  });

  return record;
}

export async function getUserNotifications(
  userId: string,
  limit = 30
): Promise<NotificationRecord[]> {
  const rows = await db.query.notification.findMany({
    where: visibleToUser(userId),
    orderBy: [desc(notification.createdAt)],
    limit,
  });

  /**
   * Every notification the user is entitled to, whichever of THEIR workspaces
   * it belongs to — deliberately not filtered to the active one. A contract
   * expiring tomorrow is worth knowing about while you happen to be working
   * personally; the list labels each one and the UI switches workspace when an
   * org notification is opened, so nothing is hidden and nothing dead-ends.
   *
   * `visibleToUser` supplies the one exclusion that keeps that promise true:
   * organizations the user is no longer a member of.
   */
  const orgIds = [...new Set(rows.map((r) => r.organizationId).filter(Boolean))] as string[];
  const orgs = orgIds.length
    ? await db
        .select({ id: organization.id, name: organization.name })
        .from(organization)
        .where(inArray(organization.id, orgIds))
    : [];
  const nameById = new Map(orgs.map((o) => [o.id, o.name]));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    organizationId: r.organizationId,
    organizationName: r.organizationId ? nameById.get(r.organizationId) ?? null : null,
    type: r.type,
    title: r.title,
    message: r.message,
    isRead: r.isRead,
    link: r.link,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  // Must use the same visibility rule as the list, or the badge counts items
  // the user cannot see and never drops to zero.
  const [result] = await db
    .select({ value: count() })
    .from(notification)
    .where(and(visibleToUser(userId), eq(notification.isRead, false)));
  return result?.value ?? 0;
}

export async function markAsRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await db
    .update(notification)
    .set({ isRead: true })
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.userId, userId)
      )
    )
    .returning({ id: notification.id });

  if (result.length > 0) {
    notificationBus.publish(userId, { type: "read", id: notificationId });
    return true;
  }
  return false;
}

export async function markAllAsRead(userId: string): Promise<number> {
  // Deliberately NOT scoped by visibleToUser: clearing should also settle the
  // backlog from workspaces the user has left, so those never resurface unread
  // if they are invited back.
  const result = await db
    .update(notification)
    .set({ isRead: true })
    .where(
      and(eq(notification.userId, userId), eq(notification.isRead, false))
    )
    .returning({ id: notification.id });

  if (result.length > 0) {
    notificationBus.publish(userId, { type: "read-all" });
  }
  return result.length;
}

export async function deleteNotification(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await db
    .delete(notification)
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.userId, userId)
      )
    )
    .returning({ id: notification.id });

  if (result.length > 0) {
    notificationBus.publish(userId, { type: "deleted", id: notificationId });
    return true;
  }
  return false;
}
