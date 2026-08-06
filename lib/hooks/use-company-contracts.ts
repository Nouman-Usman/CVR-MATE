"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonRequest } from "@/lib/api/fetch-json";
import { qk, invalidate, crmInvalidations } from "@/lib/hooks/query-keys";

export interface Contract {
  id: string;
  companyId: string;
  dealId: string | null;
  title: string;
  status: string;
  startDate: string | null;
  expiryDate: string | null;
  value: number | null;
  currency: string;
  renewalNoticeDays: number;
  autoRenew: boolean;
  externalRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractInput {
  title: string;
  status?: string;
  startDate?: string;
  expiryDate?: string;
  value?: number;
  currency?: string;
  renewalNoticeDays?: number;
  autoRenew?: boolean;
  externalRef?: string;
  notes?: string;
}

export function useCompanyContracts(vat: string) {
  return useQuery<{ contracts: Contract[]; total: number }>({
    queryKey: qk.companyContracts(vat),
    enabled: !!vat,
    queryFn: () => fetchJson(`/api/companies/${vat}/contracts`),
    staleTime: 60_000,
  });
}

export function useCreateContract(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateContractInput) =>
      fetchJson<{ contract: Contract }>(
        `/api/companies/${vat}/contracts`,
        jsonRequest("POST", body)
      ),
    onSettled: () => invalidate(qc, crmInvalidations.contractChanged(vat)),
  });
}

export function useDeleteContract(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ message: string }>(`/api/contracts/${id}`, jsonRequest("DELETE")),
    onSettled: () => invalidate(qc, crmInvalidations.contractChanged(vat)),
  });
}
