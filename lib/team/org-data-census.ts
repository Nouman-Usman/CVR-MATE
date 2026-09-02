import "server-only";

import { and, count, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  activity,
  agentSession,
  companyNote,
  companyWorkspace,
  contact,
  contract,
  crmConnection,
  deal,
  followedCompany,
  followedPerson,
  interaction,
  leadTrigger,
  matchFeedItem,
  product,
  quote,
  salesOrder,
  savedCompany,
  savedSearch,
  segment,
  todo,
} from "@/db/app-schema";

/**
 * What actually happens to an organization's data when the organization row is
 * deleted.
 *
 * Two fates, decided by the foreign key, not by any application code:
 *
 *   "destroyed"  — ON DELETE CASCADE. The rows go with the org.
 *   "privatised" — ON DELETE SET NULL. `organization_id` becomes NULL, and a
 *                  NULL organization_id means *personal*. The row survives as
 *                  the private property of whoever `user_id` points at.
 *
 * Privatisation is the more surprising of the two: nothing is lost, so nothing
 * looks wrong, but shared team data silently becomes one individual's. That is
 * a transfer of ownership, not a cleanup.
 */
export type OrgDataFate = "destroyed" | "privatised";

export interface OrgDataCount {
  /** i18n-independent key; the UI maps it to a label. */
  key: string;
  fate: OrgDataFate;
  count: number;
  /**
   * Whether this row should stop a deletion.
   *
   * Only content a person can actually clear from the UI blocks. Append-only
   * logs and system-generated rows are reported so the cost is visible, but
   * they must never gate: nothing in the product can empty them, so blocking on
   * them would make the organization permanently undeletable.
   */
  blocking: boolean;
}

interface CensusEntry {
  key: string;
  fate: OrgDataFate;
  blocking: boolean;
  table: PgTable;
  column: PgColumn;
  /**
   * Soft-delete column, where the table has one.
   *
   * Rows the user has already deleted must not count. They are invisible in the
   * product, so blocking on them would tell someone to clear data they cannot
   * see and have in fact already cleared.
   */
  deletedAt?: PgColumn;
}

/**
 * Every org-scoped table holding user-authored content.
 *
 * Deliberately EXCLUDED, because they are created by the system rather than by
 * a person, and counting them would make every organization permanently
 * undeletable:
 *
 *   organization_profile  seeded at org creation (app/api/team/create/route.ts)
 *   pipeline, pipeline_stage  default pipeline seeded on first CRM use
 *                             (lib/crm/pipeline.ts)
 *   document_sequence     created lazily by quote/order numbering
 *
 * Also excluded: member, invitation, org_audit_log, usage_record, notification
 * — org bookkeeping, not content. And child tables (quote_line,
 * sales_order_line, interaction_attachment, company_segment) — their parents
 * already account for them, so counting both would double-report.
 */
const CENSUS: CensusEntry[] = [
  // ── Destroyed with the organization (CASCADE) ────────────────────────────
  { key: "contacts", fate: "destroyed", blocking: true, table: contact, column: contact.organizationId, deletedAt: contact.deletedAt, },
  { key: "deals", fate: "destroyed", blocking: true, table: deal, column: deal.organizationId, deletedAt: deal.deletedAt, },
  { key: "quotes", fate: "destroyed", blocking: true, table: quote, column: quote.organizationId, deletedAt: quote.deletedAt, },
  { key: "salesOrders", fate: "destroyed", blocking: true, table: salesOrder, column: salesOrder.organizationId, deletedAt: salesOrder.deletedAt, },
  { key: "products", fate: "destroyed", blocking: true, table: product, column: product.organizationId, deletedAt: product.deletedAt, },
  { key: "contracts", fate: "destroyed", blocking: true, table: contract, column: contract.organizationId, deletedAt: contract.deletedAt, },
  { key: "interactions", fate: "destroyed", blocking: true, table: interaction, column: interaction.organizationId, deletedAt: interaction.deletedAt, },
  { key: "segments", fate: "destroyed", blocking: true, table: segment, column: segment.organizationId },
  {
    key: "companyWorkspaces", fate: "destroyed", blocking: false,
    table: companyWorkspace,
    column: companyWorkspace.organizationId,
  },

  // ── Silently handed to an individual (SET NULL) ──────────────────────────
  { key: "triggers", fate: "privatised", blocking: true, table: leadTrigger, column: leadTrigger.organizationId },
  {
    key: "savedCompanies", fate: "privatised", blocking: true,
    table: savedCompany,
    column: savedCompany.organizationId, deletedAt: savedCompany.deletedAt,
  },
  { key: "todos", fate: "privatised", blocking: true, table: todo, column: todo.organizationId, deletedAt: todo.deletedAt, },
  {
    key: "savedSearches", fate: "privatised", blocking: true,
    table: savedSearch,
    column: savedSearch.organizationId,
  },
  { key: "companyNotes", fate: "privatised", blocking: true, table: companyNote, column: companyNote.organizationId, deletedAt: companyNote.deletedAt, },
  {
    key: "followedCompanies", fate: "privatised", blocking: true,
    table: followedCompany,
    column: followedCompany.organizationId,
  },
  {
    key: "followedPeople", fate: "privatised", blocking: true,
    table: followedPerson,
    column: followedPerson.organizationId,
  },
  {
    key: "crmConnections", fate: "privatised", blocking: true,
    table: crmConnection,
    column: crmConnection.organizationId,
  },
  { key: "activity", fate: "privatised", blocking: false, table: activity, column: activity.organizationId },
  {
    key: "agentSessions", fate: "privatised", blocking: false,
    table: agentSession,
    column: agentSession.organizationId,
  },
  {
    key: "matchFeedItems", fate: "privatised", blocking: false,
    table: matchFeedItem,
    column: matchFeedItem.organizationId,
  },
];

/**
 * Count everything an organization owns, so a delete can state its own cost.
 *
 * Returns only the non-empty rows, "destroyed" first — that is the order a
 * warning should read in, because destruction is what the user cannot undo.
 */
export async function orgDataCensus(organizationId: string): Promise<OrgDataCount[]> {
  const counted = await Promise.all(
    CENSUS.map(async (entry) => {
      // isNotNull is redundant next to an equality test, but it documents that
      // NULL here means personal and must never be swept into an org's total.
      const where: SQL | undefined = and(
        eq(entry.column, organizationId),
        isNotNull(entry.column),
        entry.deletedAt ? isNull(entry.deletedAt) : undefined
      );
      const rows = await db.select({ value: count() }).from(entry.table).where(where);
      return {
        key: entry.key,
        fate: entry.fate,
        blocking: entry.blocking,
        count: rows[0]?.value ?? 0,
      };
    })
  );

  return counted
    .filter((c) => c.count > 0)
    .sort((a, b) =>
      a.fate === b.fate ? b.count - a.count : a.fate === "destroyed" ? -1 : 1
    );
}

/** Every row the census found, including the informational ones. */
export function censusTotal(counts: OrgDataCount[]): number {
  return counts.reduce((sum, c) => sum + c.count, 0);
}

/**
 * Rows that must be cleared before the organization can be deleted.
 *
 * This — not `censusTotal` — is what a delete should gate on. Zero here means
 * the user has emptied everything they are able to empty; whatever remains is
 * log data they have no way to remove.
 */
export function blockingTotal(counts: OrgDataCount[]): number {
  return counts.reduce((sum, c) => (c.blocking ? sum + c.count : sum), 0);
}

/**
 * Human labels for the census keys.
 *
 * The keys stay machine-readable in the JSON body so a localised UI can map
 * them itself; this is only for the fallback sentence in the error message.
 */
const LABELS: Record<string, [singular: string, plural: string]> = {
  contacts: ["contact", "contacts"],
  deals: ["deal", "deals"],
  quotes: ["quote", "quotes"],
  salesOrders: ["sales order", "sales orders"],
  products: ["product", "products"],
  contracts: ["contract", "contracts"],
  interactions: ["interaction", "interactions"],
  segments: ["segment", "segments"],
  triggers: ["trigger", "triggers"],
  savedCompanies: ["saved company", "saved companies"],
  todos: ["task", "tasks"],
  savedSearches: ["saved search", "saved searches"],
  companyNotes: ["company note", "company notes"],
  followedCompanies: ["followed company", "followed companies"],
  followedPeople: ["followed person", "followed people"],
  crmConnections: ["CRM connection", "CRM connections"],
};

/** `"3 contacts, 6 quotes, 26 saved companies"` — for an error message. */
export function describeCensus(counts: OrgDataCount[]): string {
  return counts
    .filter((c) => c.blocking)
    .map((c) => {
      const label = LABELS[c.key] ?? [c.key, c.key];
      return `${c.count} ${c.count === 1 ? label[0] : label[1]}`;
    })
    .join(", ");
}
