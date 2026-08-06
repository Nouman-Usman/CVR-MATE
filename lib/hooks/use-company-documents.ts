"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api/fetch-json";
import { qk } from "@/lib/hooks/query-keys";

export interface CompanyQuote {
  id: string;
  number: string;
  status: string;
  issueDate: string | null;
  validUntil: string | null;
  total: number; // øre
  createdAt: string;
}

export interface CompanyOrder {
  id: string;
  number: string;
  status: string;
  orderDate: string | null;
  expectedDelivery: string | null;
  total: number; // øre
  createdAt: string;
}

/** Quotes and orders for one company, for the CRM tab on its profile. */
export function useCompanyDocuments(vat: string | undefined) {
  return useQuery<{ quotes: CompanyQuote[]; orders: CompanyOrder[] }>({
    queryKey: qk.companyDocuments(vat ?? ""),
    enabled: !!vat,
    queryFn: () => fetchJson(`/api/companies/${vat}/documents`),
    staleTime: 30_000,
  });
}
