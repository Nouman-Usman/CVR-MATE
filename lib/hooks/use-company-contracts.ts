"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

const key = (vat: string) => ["company-contracts", vat] as const;

export function useCompanyContracts(vat: string) {
  return useQuery<{ contracts: Contract[]; total: number }>({
    queryKey: key(vat),
    enabled: !!vat,
    queryFn: async () => {
      const res = await fetch(`/api/companies/${vat}/contracts`);
      if (!res.ok) throw new Error("Failed to fetch contracts");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useCreateContract(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateContractInput) => {
      const res = await fetch(`/api/companies/${vat}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create contract");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key(vat) });
      qc.invalidateQueries({ queryKey: ["company-activity", vat] });
      qc.invalidateQueries({ queryKey: ["report-contract-expiry"] });
    },
  });
}

export function useDeleteContract(vat: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete contract");
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key(vat) });
      qc.invalidateQueries({ queryKey: ["company-activity", vat] });
      qc.invalidateQueries({ queryKey: ["report-contract-expiry"] });
    },
  });
}
