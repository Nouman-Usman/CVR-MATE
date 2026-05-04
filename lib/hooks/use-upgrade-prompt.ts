"use client";

import { create } from "zustand";

export const FEATURE_LABELS: Record<string, string> = {
  ai_usage: "AI usages",
  company_search: "Company searches",
  export: "Exports",
  enrichment: "Enrichments",
  email_draft: "Email drafts",
  linkedin_draft: "LinkedIn drafts",
  phone_draft: "Phone scripts",
  ai_task_suggest: "AI task suggestions",
  bulk_push: "Bulk push",
};

export const FEATURE_TO_USAGE_KEY: Record<string, string> = {
  ai_usage: "aiUsages",
  company_search: "companySearches",
  export: "exports",
  enrichment: "enrichments",
  email_draft: "emailDrafts",
  linkedin_draft: "linkedinDrafts",
  phone_draft: "phoneDrafts",
  ai_task_suggest: "aiTaskSuggestions",
  bulk_push: "bulkPush",
};

interface UpgradePromptState {
  open: boolean;
  featureKey: string | null;
  triggerUpgrade: (featureKey: string) => void;
  closeUpgrade: () => void;
}

export const useUpgradePrompt = create<UpgradePromptState>((set) => ({
  open: false,
  featureKey: null,
  triggerUpgrade: (featureKey) => set({ open: true, featureKey }),
  closeUpgrade: () => set({ open: false, featureKey: null }),
}));
