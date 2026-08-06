"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonRequest } from "@/lib/api/fetch-json";
import { qk, invalidate, crmInvalidations } from "@/lib/hooks/query-keys";

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  unitPrice: number; // øre
  vatRate: string;
  unit: string | null;
  active: boolean;
  createdAt: string;
}

export interface ProductInput {
  name: string;
  sku?: string;
  description?: string;
  unitPrice: number; // øre
  vatRate?: number;
  unit?: string;
  active?: boolean;
}

export function useProducts() {
  // `total` is the org's full product count; compare against products.length to
  // detect that the page was capped rather than showing a truncated list as if
  // it were complete.
  return useQuery<{ products: Product[]; total: number }>({
    queryKey: qk.products(),
    queryFn: () => fetchJson("/api/products"),
    staleTime: 60_000,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductInput) =>
      fetchJson<{ product: Product }>("/api/products", jsonRequest("POST", body)),
    onSettled: () => invalidate(qc, crmInvalidations.productChanged()),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<ProductInput>) =>
      fetchJson<{ product: Product }>(`/api/products/${id}`, jsonRequest("PATCH", body)),
    onSettled: () => invalidate(qc, crmInvalidations.productChanged()),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ message: string }>(`/api/products/${id}`, jsonRequest("DELETE")),
    onSettled: () => invalidate(qc, crmInvalidations.productChanged()),
  });
}
