import "server-only";

import { db } from "@/db";
import { notification } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

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
  type: "trigger" | "system" | "export" | "person_follow";
  title: string;
  message?: string;
  link?: string;
}): Promise<NotificationRecord> {
  const [row] = await db
    .insert(notification)
    .values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message ?? null,
      link: data.link ?? null,
    })
    .returning();

  const record: NotificationRecord = {
    id: row.id,
    userId: row.userId,
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
    where: eq(notification.userId, userId),
    orderBy: [desc(notification.createdAt)],
    limit,
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    type: r.type,
    title: r.title,
    message: r.message,
    isRead: r.isRead,
    link: r.link,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(notification)
    .where(
      and(eq(notification.userId, userId), eq(notification.isRead, false))
    );
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
