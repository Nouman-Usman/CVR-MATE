"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api/fetch-json";
import { qk } from "@/lib/hooks/query-keys";

export interface ExpiryBucket {
  key: string;
  count: number;
  value: number;
}

export interface ContractExpiryReport {
  buckets: ExpiryBucket[];
  totals: { count: number; value: number; active: number; expiringSoon: number };
}

export interface SegmentReportRow {
  id: string;
  name: string;
  color: string;
  companyCount: number;
  contractValue: number;
}

export function useContractExpiryReport() {
  return useQuery<ContractExpiryReport>({
    queryKey: qk.reportContractExpiry(),
    queryFn: () => fetchJson("/api/reports/contract-expiry"),
    staleTime: 60_000,
  });
}

export function useSegmentsReport() {
  return useQuery<{ segments: SegmentReportRow[] }>({
    queryKey: qk.reportSegments(),
    queryFn: () => fetchJson("/api/reports/segments"),
    staleTime: 60_000,
  });
}
