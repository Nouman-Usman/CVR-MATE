"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Segment {
  id: string;
  name: string;
  color: string;
  description: string | null;
  companyCount: number;
  createdAt: string;
}

export interface CompanySegment {
  id: string;
  name: string;
  color: string;
}

const REPORT_KEYS = [["segments"], ["report-segments"]] as const;

export function useSegments() {
  return useQuery<{ segments: Segment[] }>({
    queryKey: ["segments"],
    queryFn: async () => {
      const res = await fetch("/api/segments");
      if (!res.ok) throw new Error("Failed to fetch segments");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useCreateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; color?: string; description?: string }) => {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create segment");
      return data;
    },
    onSettled: () => REPORT_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/segments/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete segment");
      return data;
    },
    onSettled: () => REPORT_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

export function useCompanySegments(vat: string) {
  return useQuery<{ segments: CompanySegment[] }>({
    queryKey: ["company-segments", vat],
    enabled: !!vat,
    queryFn: async () => {
      const res = await fetch(`/api/companies/${vat}/segments`);
      if (!res.ok) throw new Error("Failed to fetch company segments");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useAssignSegment(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (segmentId: string) => {
      const res = await fetch(`/api/companies/${vat}/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to assign segment");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["company-segments", vat] });
      REPORT_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useUnassignSegment(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (segmentId: string) => {
      const res = await fetch(`/api/companies/${vat}/segments?segmentId=${segmentId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to remove segment");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["company-segments", vat] });
      REPORT_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}
