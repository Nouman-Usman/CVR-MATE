import "server-only";

import { db } from "@/db";
import { userBrand } from "@/db/schema";
import { eq } from "drizzle-orm";

export type UserBrand = typeof userBrand.$inferSelect;

export interface BrandAiEnrichment {
  description: string;
  valueProposition: string;
  messagingPoints: string[];
  painPointsSolved: string[];
  competitiveAdvantages: string[];
  idealCustomerProfile: string;
  pricingModel: string;
  geographicFocus: string;
  generatedAt: string;
}

export async function getUserBrand(userId: string): Promise<UserBrand | undefined> {
  return db.query.userBrand.findFirst({
    where: eq(userBrand.userId, userId),
  });
}

export function formatBrandContext(brand: UserBrand | null | undefined): string {
  if (!brand) return "";

  const enrichment = brand.aiEnrichment as BrandAiEnrichment | null;

  let context = `
ABOUT THE SENDER (the user's own company):
- Company: ${brand.companyName}
- Industry: ${brand.industry ?? "Not specified"}
- What they sell: ${brand.products}
- Target audience: ${brand.targetAudience ?? "Not specified"}
- Company size: ${brand.companySize ?? "Not specified"}${brand.employees ? ` (~${brand.employees} employees)` : ""}
- Website: ${brand.website ?? "Not specified"}
- Preferred communication tone: ${brand.tone ?? "formal"}`;

  if (enrichment) {
    context += `

AI-ENRICHED BRAND PROFILE:
- Description: ${enrichment.description}
- Value proposition: ${enrichment.valueProposition}
- Key messaging: ${enrichment.messagingPoints?.join("; ")}
- Pain points solved: ${enrichment.painPointsSolved?.join("; ")}
- Competitive advantages: ${enrichment.competitiveAdvantages?.join("; ")}
- Ideal customer: ${enrichment.idealCustomerProfile}
- Pricing model: ${enrichment.pricingModel}
- Geographic focus: ${enrichment.geographicFocus}`;
  }

  const aiDosList = Array.isArray(brand.aiDos) ? (brand.aiDos as string[]) : [];
  const aiDontsList = Array.isArray(brand.aiDonts) ? (brand.aiDonts as string[]) : [];
  const hasDos = aiDosList.length > 0;
  const hasDonts = aiDontsList.length > 0;
  const hasInstructions = brand.writingInstructions ? brand.writingInstructions.trim().length > 0 : false;

  if (hasInstructions || hasDos || hasDonts) {
    context += `

AI WRITING STYLE:
- Tone: ${brand.tone ?? "formal"}`;
    if (hasInstructions && brand.writingInstructions) {
      context += `\n- Instructions: ${brand.writingInstructions.trim()}`;
    }
    if (hasDos) {
      context += `\n- Do: ${aiDosList.join(" | ")}`;
    }
    if (hasDonts) {
      context += `\n- Don't: ${aiDontsList.join(" | ")}`;
    }
  }

  return context.trim();
}
