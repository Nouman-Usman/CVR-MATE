import type { PlanId } from "@/lib/stripe/plans";

export interface QualifyingAnswers {
  teamSize?: "solo" | "small" | "medium" | "large";
  monthlyProspectingVolume?: "low" | "medium" | "high";
  useCase?: string;
}

/**
 * Pure, deterministic plan recommendation — no AI involved. The AI drafts the
 * conversational phrasing around this pick; it never picks the tier itself.
 * Enterprise is sales-assisted only, so self-serve recommendations stay within
 * starter/professional.
 */
export function recommendPlan(answers: QualifyingAnswers): PlanId {
  if (answers.monthlyProspectingVolume === "high") return "professional";
  if (answers.teamSize === "medium" || answers.teamSize === "large") return "professional";
  return "starter";
}
