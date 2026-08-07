import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { deal } from "@/db/schema";

import type { Subject } from "./keys";
import type { FollowUpCandidate } from "./types";

/**
 * Deciding which card a candidate belongs to.
 *
 * `quote.dealId`, `contract.dealId` and `interaction.dealId` all exist, are all
 * validated by their APIs — and are all NULL on every row in the database,
 * because no form in the app sends them. Verified: 0 of 3 quotes, 0 of 1
 * contract, 0 of 1 interaction. `components/quotes/QuoteBuilder.tsx` contains
 * no `dealId` reference at all.
 *
 * So the column is read when present and derived when not. `companyId` is
 * NOT NULL everywhere, which makes it the only join that can be relied on.
 */

/** The subset of `deal` needed to choose between several open deals. */
export interface DealChoice {
  id: string;
  companyId: string;
  stageChangedAt: Date | null;
  createdAt: Date;
}

/**
 * Pick one open deal for a company. PURE — exported for its own tests.
 *
 * Most companies have zero or one open deal, so this is usually trivial. When
 * there are several, the most recently touched one is the best guess at "the
 * deal this quote is about", and falling back to `createdAt` matters because
 * `stageChangedAt` is null for any deal that has never moved. Ties break on
 * `id` so the choice never flips between requests.
 */
export function pickDeal(deals: DealChoice[]): DealChoice | null {
  if (deals.length === 0) return null;
  return [...deals].sort((a, b) => {
    const aAt = (a.stageChangedAt ?? a.createdAt).getTime();
    const bAt = (b.stageChangedAt ?? b.createdAt).getTime();
    if (aAt !== bAt) return bAt - aAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}

/**
 * One query for every company that needs resolving.
 *
 * Batched deliberately: resolving per candidate would be an N+1 across three
 * signals, and the collector already knows the full set of companies up front.
 */
export async function loadOpenDealsByCompany(params: {
  organizationId: string;
  companyIds: string[];
}): Promise<Map<string, string>> {
  const { organizationId, companyIds } = params;
  const resolved = new Map<string, string>();
  // `inArray` with an empty list is not valid SQL — and there is nothing to ask.
  if (companyIds.length === 0) return resolved;

  const rows = await db
    .select({
      id: deal.id,
      companyId: deal.companyId,
      stageChangedAt: deal.stageChangedAt,
      createdAt: deal.createdAt,
    })
    .from(deal)
    .where(
      and(
        eq(deal.organizationId, organizationId),
        eq(deal.status, "open"),
        isNull(deal.deletedAt),
        inArray(deal.companyId, companyIds)
      )
    );

  const byCompany = new Map<string, DealChoice[]>();
  for (const row of rows) {
    const bucket = byCompany.get(row.companyId);
    if (bucket) bucket.push(row);
    else byCompany.set(row.companyId, [row]);
  }

  for (const [companyId, deals] of byCompany) {
    const chosen = pickDeal(deals);
    if (chosen) resolved.set(companyId, chosen.id);
  }
  return resolved;
}

/**
 * Attach a subject to a candidate. PURE given the lookup map.
 *
 * Falls back to the company rather than dropping the candidate: an unanswered
 * quote sent to a company with no open deal is not noise, it is the follow-up
 * most likely to be forgotten. Its card simply offers "Create deal" instead of
 * "Open deal".
 */
export function resolveSubject(
  candidate: FollowUpCandidate,
  dealByCompany: Map<string, string>
): Subject {
  if (candidate.dealId) return { type: "deal", id: candidate.dealId };
  const derived = dealByCompany.get(candidate.companyId);
  if (derived) return { type: "deal", id: derived };
  return { type: "company", id: candidate.companyId };
}

/** Companies whose candidates still need a deal looked up. */
export function companiesNeedingResolution(candidates: FollowUpCandidate[]): string[] {
  const needed = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.dealId) needed.add(candidate.companyId);
  }
  return [...needed];
}
