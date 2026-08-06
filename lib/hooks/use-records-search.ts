"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api/fetch-json";
import { qk } from "@/lib/hooks/query-keys";

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
  // Key on the trimmed term, not the raw one: the request already trims, so
  // keying on the raw value cached "foo" and "foo " as two entries for one call.
  const term = q.trim();
  return useQuery<RecordsSearchResult>({
    queryKey: qk.recordsSearch(term),
    enabled: term.length >= 2,
    queryFn: () => fetchJson<RecordsSearchResult>(`/api/records/search?q=${encodeURIComponent(term)}`),
    staleTime: 30_000,
  });
}
