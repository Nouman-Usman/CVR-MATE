"use client";

import { useQuery } from "@tanstack/react-query";

export type RecordsSearchMode = "email" | "phone" | "cvr" | "name" | "empty";

export interface RecordCompanyHit {
  vat: string;
  name: string;
  city: string | null;
  status: string | null; // workspace pipeline status, or null when only saved
  saved: boolean;
}

export interface RecordContactHit {
  id: string;
  name: string;
  title: string | null;
  companyVat: string;
  companyName: string;
}

export interface RecordsSearchResult {
  query: string;
  mode: RecordsSearchMode;
  companies: RecordCompanyHit[];
  contacts: RecordContactHit[];
}

/**
 * Search the org's own records (workspace companies + contacts). Enabled only
 * for queries of 2+ chars; email/phone match exactly, names match as substrings.
 */
export function useRecordsSearch(q: string) {
  return useQuery<RecordsSearchResult>({
    queryKey: ["records-search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const res = await fetch(`/api/records/search?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Search failed");
      }
      return res.json() as Promise<RecordsSearchResult>;
    },
    staleTime: 30_000,
  });
}
