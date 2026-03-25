import "server-only";

import { db } from "@/db";
import { userBrand } from "@/db/schema";
import { eq } from "drizzle-orm";

export type UserBrand = typeof userBrand.$inferSelect;

export async function getUserBrand(userId: string): Promise<UserBrand | undefined> {
  return db.query.userBrand.findFirst({
    where: eq(userBrand.userId, userId),
  });
}

export function formatBrandContext(brand: UserBrand | null | undefined): string {
  if (!brand) return "";

  return `
ABOUT THE SENDER (the user's own company):
- Company: ${brand.companyName}
- Industry: ${brand.industry ?? "Not specified"}
- What they sell: ${brand.products}
- Target audience: ${brand.targetAudience ?? "Not specified"}
- Company size: ${brand.companySize ?? "Not specified"}${brand.employees ? ` (~${brand.employees} employees)` : ""}
- Website: ${brand.website ?? "Not specified"}
- Preferred communication tone: ${brand.tone ?? "formal"}
`.trim();
}
