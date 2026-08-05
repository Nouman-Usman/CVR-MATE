"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
 * company and seeding contacts. On success we invalidate the destination
 * company's contact + activity caches (so /company/[vat] renders fresh) plus the
 * saved-companies list.
 */
export function useCreateProspect() {
  const qc = useQueryClient();
  return useMutation<CreateProspectResult, Error, CreateProspectInput>({
    mutationFn: async (body) => {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create prospect");
      return data as CreateProspectResult;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["contacts", data.vat] });
      qc.invalidateQueries({ queryKey: ["company-activity", data.vat] });
      qc.invalidateQueries({ queryKey: ["saved-companies"] });
    },
  });
}
