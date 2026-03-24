"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export function useNotifications() {
  return useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return data?.unreadCount ?? 0;
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<NotificationsResponse>(["notifications"]);
      if (prev) {
        qc.setQueryData<NotificationsResponse>(["notifications"], {
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, prev.unreadCount - 1),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<NotificationsResponse>(["notifications"]);
      if (prev) {
        qc.setQueryData<NotificationsResponse>(["notifications"], {
          notifications: prev.notifications.map((n) => ({
            ...n,
            isRead: true,
          })),
          unreadCount: 0,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete notification");
      return res.json();
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const prev = qc.getQueryData<NotificationsResponse>(["notifications"]);
      if (prev) {
        const deleted = prev.notifications.find((n) => n.id === id);
        qc.setQueryData<NotificationsResponse>(["notifications"], {
          notifications: prev.notifications.filter((n) => n.id !== id),
          unreadCount:
            deleted && !deleted.isRead
              ? Math.max(0, prev.unreadCount - 1)
              : prev.unreadCount,
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev);
    },
  });
}

/**
 * SSE hook — connects to /api/notifications/stream and updates the
 * TanStack Query cache in real time when notifications arrive.
 * Auto-reconnects on disconnect with exponential backoff.
 */
export function useNotificationStream() {
  const qc = useQueryClient();
  const retryRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    // Close existing connection
    eventSourceRef.current?.close();

    const es = new EventSource("/api/notifications/stream");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        retryRef.current = 0; // Reset backoff on successful message

        if (data.type === "connected") {
          // Initial unread count from server
          const prev = qc.getQueryData<NotificationsResponse>([
            "notifications",
          ]);
          if (prev) {
            qc.setQueryData<NotificationsResponse>(["notifications"], {
              ...prev,
              unreadCount: data.unreadCount,
            });
          }
          return;
        }

        if (data.type === "new" && data.notification) {
          // New notification — prepend to list and bump unread
          qc.setQueryData<NotificationsResponse>(["notifications"], (old) => {
            if (!old) return old;
            return {
              notifications: [data.notification, ...old.notifications].slice(
                0,
                50
              ),
              unreadCount: old.unreadCount + 1,
            };
          });
          return;
        }

        if (data.type === "read" && data.id) {
          qc.setQueryData<NotificationsResponse>(["notifications"], (old) => {
            if (!old) return old;
            return {
              notifications: old.notifications.map((n) =>
                n.id === data.id ? { ...n, isRead: true } : n
              ),
              unreadCount: Math.max(0, old.unreadCount - 1),
            };
          });
          return;
        }

        if (data.type === "read-all") {
          qc.setQueryData<NotificationsResponse>(["notifications"], (old) => {
            if (!old) return old;
            return {
              notifications: old.notifications.map((n) => ({
                ...n,
                isRead: true,
              })),
              unreadCount: 0,
            };
          });
          return;
        }

        if (data.type === "deleted" && data.id) {
          qc.setQueryData<NotificationsResponse>(["notifications"], (old) => {
            if (!old) return old;
            const deleted = old.notifications.find((n) => n.id === data.id);
            return {
              notifications: old.notifications.filter(
                (n) => n.id !== data.id
              ),
              unreadCount:
                deleted && !deleted.isRead
                  ? Math.max(0, old.unreadCount - 1)
                  : old.unreadCount,
            };
          });
          return;
        }
      } catch {
        // Ignore parse errors (heartbeats, etc.)
      }
    };

    es.onerror = () => {
      es.close();
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
      retryRef.current++;
      setTimeout(connect, delay);
    };
  }, [qc]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);
}
