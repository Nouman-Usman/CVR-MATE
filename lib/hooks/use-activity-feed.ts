"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api/fetch-json";
import { qk } from "@/lib/hooks/query-keys";
import type { ActivityAction, ActivityEntityType } from "@/lib/activity/vocabulary";

export interface ActivityEvent {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  /** Resolved from metadata.companyId server-side; null when not company-scoped. */
  companyVat: string | null;
  actor: { id: string; name: string | null; image: string | null } | null;
  createdAt: string;
}

export interface ActivityFilters {
  entityType?: ActivityEntityType[];
  action?: ActivityAction[];
  userId?: string | null;
  /** YYYY-MM-DD, inclusive. */
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
}

export interface ActivityPage {
  activity: ActivityEvent[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Serialise filters into a query string.
 *
 * Multi-value filters are sent comma-joined and array order is normalised, so
 * picking "quote, order" and "order, quote" hit the same cache entry instead of
 * refetching identical data under two keys.
 */
export function activityQueryString(f: ActivityFilters): string {
  const p = new URLSearchParams();
  if (f.entityType?.length) p.set("entityType", [...f.entityType].sort().join(","));
  if (f.action?.length) p.set("action", [...f.action].sort().join(","));
  if (f.userId) p.set("userId", f.userId);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.limit != null) p.set("limit", String(f.limit));
  if (f.offset) p.set("offset", String(f.offset));
  return p.toString();
}

/** Org-wide audit history. */
export function useActivityFeed(filters: ActivityFilters) {
  const qs = activityQueryString(filters);
  return useQuery<ActivityPage>({
    queryKey: qk.activityFeed(qs),
    queryFn: () => fetchJson(`/api/activity${qs ? `?${qs}` : ""}`),
    // Paging without this blanks the table on every page change, which reads as
    // a failure rather than a load.
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** The distinct people who appear in this org's history, for the "who" filter. */
export function useActivityActors() {
  return useQuery<{ actors: Array<{ id: string; name: string | null; image: string | null }> }>({
    queryKey: qk.activityActors(),
    queryFn: () => fetchJson("/api/activity/actors"),
    staleTime: 5 * 60_000,
  });
}
