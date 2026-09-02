import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { accountingConnection, orderInvoice } from "@/db/app-schema";

import {
  clientFor,
  recordConnectionError,
  recordConnectionSuccess,
  type ConnectionRow,
} from "./connection";
import { AccountingError, type InvoiceStatus } from "./types";

/**
 * Statuses still worth asking about.
 *
 * `paid`, `credited` and `cancelled` are terminal — an invoice does not become
 * unpaid — so re-reading them would spend the provider's rate limit to learn
 * nothing. `overdue` stays in the list because it becomes `paid`.
 */
const OPEN_STATUSES: InvoiceStatus[] = ["draft", "booked", "sent", "overdue"];

export interface SyncResult {
  checked: number;
  updated: number;
  failed: number;
}

/**
 * Re-read every open invoice and mirror the provider's answer.
 *
 * This is the only writer of `order_invoice.status`, `invoiceNumber` and the
 * amounts. Nothing in the product edits them by hand — the moment it could,
 * there would be two sources of truth for a legal document.
 *
 * One connection failing must not stop the others: a single expired agreement
 * grant would otherwise block every organization's sync.
 */
export async function syncInvoices(organizationId?: string): Promise<SyncResult> {
  const connections = await db
    .select()
    .from(accountingConnection)
    .where(
      and(
        eq(accountingConnection.isActive, true),
        organizationId ? eq(accountingConnection.organizationId, organizationId) : undefined
      )
    );

  const result: SyncResult = { checked: 0, updated: 0, failed: 0 };

  for (const connection of connections) {
    try {
      const partial = await syncConnection(connection);
      result.checked += partial.checked;
      result.updated += partial.updated;
      result.failed += partial.failed;
    } catch (err) {
      // Whole-connection failure (bad credential, provider down). Record it so
      // the org can see the integration is broken, and carry on.
      result.failed++;
      await recordConnectionError(
        connection.id,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return result;
}

async function syncConnection(connection: ConnectionRow): Promise<SyncResult> {
  const client = clientFor(connection);

  const open = await db
    .select({
      id: orderInvoice.id,
      externalId: orderInvoice.externalId,
      status: orderInvoice.status,
      invoiceNumber: orderInvoice.invoiceNumber,
      total: orderInvoice.total,
    })
    .from(orderInvoice)
    .where(
      and(
        eq(orderInvoice.connectionId, connection.id),
        inArray(orderInvoice.status, OPEN_STATUSES),
        ne(orderInvoice.status, "cancelled")
      )
    );

  const result: SyncResult = { checked: 0, updated: 0, failed: 0 };

  for (const row of open) {
    result.checked++;
    try {
      const latest = await client.getInvoice(row.externalId);

      if (!latest) {
        // Gone from both collections. A draft someone deleted in e-conomic is
        // the realistic cause; cancelling the mirror keeps the order
        // re-invoiceable instead of permanently blocked by the live-unique index.
        if (row.status === "draft") {
          await db
            .update(orderInvoice)
            .set({ status: "cancelled", lastSyncedAt: new Date() })
            .where(eq(orderInvoice.id, row.id));
          result.updated++;
        }
        continue;
      }

      const changed =
        latest.status !== row.status ||
        latest.invoiceNumber !== row.invoiceNumber ||
        latest.totalOre !== row.total;

      await db
        .update(orderInvoice)
        .set({
          status: latest.status,
          invoiceNumber: latest.invoiceNumber,
          total: latest.totalOre,
          vatTotal: latest.vatTotalOre,
          issueDate: latest.issueDate,
          dueDate: latest.dueDate,
          pdfUrl: latest.pdfUrl,
          lastSyncedAt: new Date(),
        })
        .where(eq(orderInvoice.id, row.id));

      if (changed) result.updated++;
    } catch (err) {
      // One invoice failing is not the connection failing — keep going.
      result.failed++;
      if (err instanceof AccountingError && err.code === "AUTH_FAILED") throw err;
    }
  }

  if (result.failed === 0) await recordConnectionSuccess(connection.id);
  return result;
}
