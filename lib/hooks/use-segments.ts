"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonRequest } from "@/lib/api/fetch-json";
import { qk, invalidate, crmInvalidations } from "@/lib/hooks/query-keys";

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

export function useSegments() {
  return useQuery<{ segments: Segment[] }>({
    queryKey: qk.segments(),
    queryFn: () => fetchJson("/api/segments"),
    staleTime: 60_000,
  });
}

export function useCreateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color?: string; description?: string }) =>
      fetchJson<{ segment: Segment }>("/api/segments", jsonRequest("POST", body)),
    onSettled: () => invalidate(qc, crmInvalidations.segmentChanged()),
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ message: string }>(`/api/segments/${id}`, jsonRequest("DELETE")),
    onSettled: () => invalidate(qc, crmInvalidations.segmentChanged()),
  });
}

export function useCompanySegments(vat: string) {
  return useQuery<{ segments: CompanySegment[] }>({
    queryKey: qk.companySegments(vat),
    enabled: !!vat,
    queryFn: () => fetchJson(`/api/companies/${vat}/segments`),
    staleTime: 60_000,
  });
}

export function useAssignSegment(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (segmentId: string) =>
      fetchJson<{ ok: true }>(
        `/api/companies/${vat}/segments`,
        jsonRequest("POST", { segmentId })
      ),
    onSettled: () => invalidate(qc, crmInvalidations.segmentChanged(vat)),
  });
}

export function useUnassignSegment(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (segmentId: string) =>
      fetchJson<{ ok: true }>(
        `/api/companies/${vat}/segments?segmentId=${segmentId}`,
        jsonRequest("DELETE")
      ),
    onSettled: () => invalidate(qc, crmInvalidations.segmentChanged(vat)),
  });
}
