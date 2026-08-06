"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonRequest } from "@/lib/api/fetch-json";
import { invalidate, crmInvalidations } from "@/lib/hooks/query-keys";

/** A contact as entered in the prospect flow (matches contactCreateSchema). */
export interface ProspectContactInput {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  notes?: string;
  isPrimary?: boolean;
  lawfulBasis?: "legitimate_interest" | "consent" | "contract";
}

export type WorkspaceStatus =
  | "prospect"
  | "lead"
  | "qualified"
  | "customer"
  | "churned";

export interface CreateProspectInput {
  vat: string;
  status?: WorkspaceStatus;
  tags?: string[];
  save?: boolean;
  note?: string;
  contacts?: ProspectContactInput[];
}

export interface CreateProspectResult {
  companyId: string;
  vat: string;
  workspaceId: string;
  workspaceCreated: boolean;
  saved: boolean;
  contacts: { id: string; name: string }[];
  skippedContacts: string[];
}

/**
 * Create (or refresh) a prospect from a CVR number, optionally saving the
 * company and seeding contacts. On success `crmInvalidations.prospectCreated`
 * refreshes the destination company's caches (so /company/[vat] renders fresh)
 * along with the lists the new prospect now belongs to.
 */
export function useCreateProspect() {
  const qc = useQueryClient();
  return useMutation<CreateProspectResult, Error, CreateProspectInput>({
    mutationFn: (body) => fetchJson<CreateProspectResult>("/api/prospects", jsonRequest("POST", body)),
    onSuccess: (data) => invalidate(qc, crmInvalidations.prospectCreated(data.vat)),
  });
}
