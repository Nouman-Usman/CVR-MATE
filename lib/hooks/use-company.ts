"use client";

import { useQuery } from "@tanstack/react-query";
import type { CvrCompanyResult } from "@/lib/cvr-client";

interface CompanyResponse {
  company?: CvrCompanyResult;
  error?: string;
}

export function useCompany(vat: string | undefined) {
  return useQuery<CompanyResponse>({
    queryKey: ["company", vat],
    queryFn: async () => {
      const res = await fetch(`/api/cvr/company?vat=${vat}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load company");
      }
      return res.json();
    },
    enabled: !!vat,
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
  });
}
