"use client";

import { useQuery } from "@tanstack/react-query";

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
    queryKey: ["report-contract-expiry"],
    queryFn: async () => {
      const res = await fetch("/api/reports/contract-expiry");
      if (!res.ok) throw new Error("Failed to load contract report");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useSegmentsReport() {
  return useQuery<{ segments: SegmentReportRow[] }>({
    queryKey: ["report-segments"],
    queryFn: async () => {
      const res = await fetch("/api/reports/segments");
      if (!res.ok) throw new Error("Failed to load segment report");
      return res.json();
    },
    staleTime: 60_000,
  });
}
