import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { accountingConnection, organizationProfile } from "@/db/app-schema";
import { decrypt, encrypt } from "@/lib/crm/encryption";

import { EconomicClient, type EconomicSettings } from "./providers/economic";
import {
  AccountingError,
  ACCOUNTING_PROVIDER_LABELS,
  type AccountingClient,
  type AccountingProvider,
  type SettingsChoice,
} from "./types";

export type ConnectionRow = typeof accountingConnection.$inferSelect;

/**
 * The active bookkeeping connection for an organization.
 *
 * Organization-scoped by construction — there is no user-scoped variant,
 * because there is no such thing as a personal set of company books.
 */
export async function getActiveConnection(
  organizationId: string,
  provider?: AccountingProvider
): Promise<ConnectionRow | null> {
  const [row] = await db
    .select()
    .from(accountingConnection)
    .where(
      and(
        eq(accountingConnection.organizationId, organizationId),
        eq(accountingConnection.isActive, true),
        provider ? eq(accountingConnection.provider, provider) : undefined
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * Build a provider client from a stored connection.
 *
 * The app secret is read from the environment, never from the row: it
 * identifies CVR-MATE rather than the customer, so storing it per organization
 * would mean rotating one secret in N places.
 */
export function clientFor(connection: ConnectionRow): AccountingClient {
  switch (connection.provider as AccountingProvider) {
    case "economic": {
      const appSecretToken = process.env.ECONOMIC_APP_SECRET_TOKEN;
      if (!appSecretToken) {
        throw new AccountingError(
          "NOT_CONNECTED",
          "e-conomic is not configured on this deployment (ECONOMIC_APP_SECRET_TOKEN is unset)."
        );
      }
      return new EconomicClient({
        appSecretToken,
        agreementGrantToken: decrypt(connection.accessToken),
        settings: (connection.settings ?? {}) as Partial<EconomicSettings>,
      });
    }
    // Dinero and Billy are accepted by the schema so the column never has to
    // change, but no adapter exists yet. Failing here is better than a silent
    // no-op that looks like a working connection.
    default:
      throw new AccountingError(
        "NOT_CONNECTED",
        `${ACCOUNTING_PROVIDER_LABELS[connection.provider as AccountingProvider] ?? connection.provider} is not supported yet.`
      );
  }
}

/** Resolve the org's connection and its client together, or explain why not. */
export async function requireConnection(
  organizationId: string,
  provider?: AccountingProvider
): Promise<{ connection: ConnectionRow; client: AccountingClient }> {
  const connection = await getActiveConnection(organizationId, provider);
  if (!connection) {
    throw new AccountingError(
      "NOT_CONNECTED",
      "Connect a bookkeeping system before invoicing an order."
    );
  }
  return { connection, client: clientFor(connection) };
}

export interface ConnectInput {
  organizationId: string;
  userId: string;
  provider: AccountingProvider;
  /** e-conomic: the agreement grant token. Stored encrypted. */
  accessToken: string;
  /**
   * Provider configuration. Omit to have it read from the agreement — the
   * normal path, so nobody has to look up internal numbers by hand.
   */
  settings?: Record<string, unknown>;
}

export interface ConnectResult {
  connection: ConnectionRow;
  /** What was chosen and what else was available, for the review UI. */
  choices: SettingsChoice[];
  /** False when something was guessed and a person should confirm it. */
  complete: boolean;
}

/**
 * Store a connection after verifying it works.
 *
 * Verification is not optional: an unverified row looks identical to a working
 * one until the first invoice fails, and by then the user has an order they
 * believe is invoiced.
 *
 * Reconnecting the same provider replaces the previous row rather than adding
 * one — `accounting_connection_active_uq` allows a single active row per
 * (org, provider), so the old one is deactivated first and kept as history.
 */
export async function connectAccounting(input: ConnectInput): Promise<ConnectResult> {
  const probe = buildProbeClient(input);
  const { agreementName } = await probe.verifyConnection();

  // The org's own net-days default decides which payment terms to match, so
  // the discovered configuration agrees with what the order already assumed.
  const [profile] = await db
    .select({ terms: organizationProfile.defaultPaymentTermsDays })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, input.organizationId))
    .limit(1);

  let settings = input.settings;
  let choices: SettingsChoice[] = [];
  let complete = true;

  if (!settings || Object.keys(settings).length === 0) {
    const discovered = await probe.discoverSettings(profile?.terms ?? 14);
    settings = discovered.settings;
    choices = discovered.choices;
    complete = discovered.complete;
  }

  const connection = await db.transaction(async (tx) => {
    await tx
      .update(accountingConnection)
      .set({ isActive: false })
      .where(
        and(
          eq(accountingConnection.organizationId, input.organizationId),
          eq(accountingConnection.provider, input.provider),
          eq(accountingConnection.isActive, true)
        )
      );

    const [row] = await tx
      .insert(accountingConnection)
      .values({
        organizationId: input.organizationId,
        connectedBy: input.userId,
        provider: input.provider,
        accessToken: encrypt(input.accessToken),
        agreementName,
        // The resolved settings, not the input: discovery fills these when the
        // caller supplied none, and storing `input.settings` would throw that away.
        settings,
        isActive: true,
      })
      .returning();
    return row;
  });

  return { connection, choices, complete };
}

/**
 * Change a stored connection's provider configuration.
 *
 * Separate from connecting because the interesting case is correcting a guess —
 * a wrong VAT zone invoices at the wrong rate, and the person who notices is
 * usually not the person who connected it. Merged rather than replaced so a
 * single field can be fixed without re-supplying the rest.
 */
export async function updateConnectionSettings(
  organizationId: string,
  provider: AccountingProvider,
  patch: Record<string, unknown>
): Promise<ConnectionRow | null> {
  const current = await getActiveConnection(organizationId, provider);
  if (!current) return null;

  const merged = { ...((current.settings ?? {}) as Record<string, unknown>), ...patch };
  const [row] = await db
    .update(accountingConnection)
    .set({ settings: merged })
    .where(eq(accountingConnection.id, current.id))
    .returning();
  return row ?? null;
}

/** Re-read the agreement's defaults for an existing connection. */
export async function rediscoverSettings(
  organizationId: string,
  provider: AccountingProvider
): Promise<{ choices: SettingsChoice[]; complete: boolean } | null> {
  const connection = await getActiveConnection(organizationId, provider);
  if (!connection) return null;

  const [profile] = await db
    .select({ terms: organizationProfile.defaultPaymentTermsDays })
    .from(organizationProfile)
    .where(eq(organizationProfile.organizationId, organizationId))
    .limit(1);

  const discovered = await clientFor(connection).discoverSettings(profile?.terms ?? 14);
  return { choices: discovered.choices, complete: discovered.complete };
}

/** A client built from the credential being offered, before anything is stored. */
function buildProbeClient(input: ConnectInput): AccountingClient {
  if (input.provider !== "economic") {
    throw new AccountingError(
      "INVALID_REQUEST",
      `${ACCOUNTING_PROVIDER_LABELS[input.provider]} is not supported yet.`
    );
  }
  const appSecretToken = process.env.ECONOMIC_APP_SECRET_TOKEN;
  if (!appSecretToken) {
    throw new AccountingError(
      "NOT_CONNECTED",
      "e-conomic is not configured on this deployment (ECONOMIC_APP_SECRET_TOKEN is unset)."
    );
  }
  return new EconomicClient({
    appSecretToken,
    agreementGrantToken: input.accessToken,
    settings: input.settings as Partial<EconomicSettings>,
  });
}

/**
 * Disconnect, without destroying history.
 *
 * Deactivated rather than deleted: `order_invoice.connectionId` is SET NULL on
 * delete, but the invoices themselves must stay readable, and keeping the row
 * means the audit trail still says which agreement issued them.
 */
export async function disconnectAccounting(
  organizationId: string,
  provider: AccountingProvider
): Promise<boolean> {
  const rows = await db
    .update(accountingConnection)
    .set({ isActive: false })
    .where(
      and(
        eq(accountingConnection.organizationId, organizationId),
        eq(accountingConnection.provider, provider),
        eq(accountingConnection.isActive, true)
      )
    )
    .returning({ id: accountingConnection.id });
  return rows.length > 0;
}

/** Record a sync failure so a broken connection is visible, not silent. */
export async function recordConnectionError(
  connectionId: string,
  message: string
): Promise<void> {
  await db
    .update(accountingConnection)
    .set({ lastErrorAt: new Date(), lastError: message.slice(0, 500) })
    .where(eq(accountingConnection.id, connectionId));
}

/** Clear the error marker after a successful call. */
export async function recordConnectionSuccess(connectionId: string): Promise<void> {
  await db
    .update(accountingConnection)
    .set({ lastSyncedAt: new Date(), lastErrorAt: null, lastError: null })
    .where(eq(accountingConnection.id, connectionId));
}
