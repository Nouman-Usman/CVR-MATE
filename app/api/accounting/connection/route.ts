import { NextRequest, NextResponse } from "next/server";

import { requireCrmOrg, crmErrorResponse } from "@/lib/crm/guard";
import { assertPermission, TeamPermissionError, teamErrorToStatus } from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  connectAccounting,
  disconnectAccounting,
  getActiveConnection,
  rediscoverSettings,
  updateConnectionSettings,
} from "@/lib/accounting/connection";
import {
  AccountingError,
  accountingErrorToStatus,
  ACCOUNTING_PROVIDERS,
  type AccountingProvider,
} from "@/lib/accounting/types";

export const runtime = "nodejs";

/** GET — the org's current bookkeeping connection, without the credential. */
export async function GET(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { organizationId } = guard.ctx;

  try {
    const connection = await getActiveConnection(organizationId);
    if (!connection) return NextResponse.json({ connection: null });

    // accessToken is deliberately absent: it is a bookkeeping credential and
    // nothing in the UI needs it.
    return NextResponse.json({
      connection: {
        id: connection.id,
        provider: connection.provider,
        agreementName: connection.agreementName,
        connectedAt: connection.connectedAt,
        lastSyncedAt: connection.lastSyncedAt,
        lastErrorAt: connection.lastErrorAt,
        lastError: connection.lastError,
        settings: connection.settings,
      },
    });
  } catch (err) {
    return crmErrorResponse(err);
  }
}

/**
 * POST — connect a bookkeeping system.
 *
 * Owner/admin only. Connecting the books is a different decision from
 * connecting a CRM, and it reaches the org's financial records, so it reuses
 * the strongest permission the team model has rather than plain membership.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "accounting_connect", 10, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    await assertPermission(userId, organizationId, "manage_integrations");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: teamErrorToStatus(err) }
      );
    }
    throw err;
  }

  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    accessToken?: string;
    settings?: Record<string, unknown>;
  };

  const provider = body.provider as AccountingProvider | undefined;
  if (!provider || !ACCOUNTING_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `provider must be one of ${ACCOUNTING_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!body.accessToken || typeof body.accessToken !== "string") {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }

  try {
    // connectAccounting verifies against the provider BEFORE storing, so a
    // dead credential can never masquerade as a working connection.
    // Settings omitted on the normal path: connectAccounting reads them from
    // the agreement so nobody has to look up internal e-conomic numbers.
    const { connection, choices, complete } = await connectAccounting({
      organizationId,
      userId,
      provider,
      accessToken: body.accessToken,
      settings: body.settings,
    });

    await logOrgEvent({
      organizationId,
      actorId: userId,
      action: "accounting_connected",
      metadata: { provider, agreementName: connection.agreementName },
    });

    return NextResponse.json(
      {
        connection: {
          id: connection.id,
          provider: connection.provider,
          agreementName: connection.agreementName,
          connectedAt: connection.connectedAt,
          settings: connection.settings,
        },
        // Returned so the UI can show what was picked and let a person change
        // it — a wrong VAT zone invoices at the wrong rate.
        choices,
        needsReview: !complete,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AccountingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: accountingErrorToStatus(err) }
      );
    }
    return crmErrorResponse(err);
  }
}

/**
 * PATCH — correct the discovered configuration.
 *
 * The interesting case is fixing a guess. Discovery picks the domestic VAT zone
 * by name and admits when it could not; if it guessed wrong, every invoice goes
 * out at the wrong rate, and whoever notices needs a way to fix it that does not
 * involve reconnecting.
 *
 * `?rediscover=1` re-reads the agreement instead, for when the answer changed
 * on their side.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  try {
    await assertPermission(userId, organizationId, "manage_integrations");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: teamErrorToStatus(err) }
      );
    }
    throw err;
  }

  const provider = (req.nextUrl.searchParams.get("provider") ?? "economic") as AccountingProvider;
  if (!ACCOUNTING_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }

  try {
    if (req.nextUrl.searchParams.get("rediscover") === "1") {
      const found = await rediscoverSettings(organizationId, provider);
      if (!found) return NextResponse.json({ error: "Not connected" }, { status: 409 });
      return NextResponse.json({ choices: found.choices, needsReview: !found.complete });
    }

    const body = (await req.json().catch(() => ({}))) as { settings?: Record<string, unknown> };
    if (!body.settings || typeof body.settings !== "object") {
      return NextResponse.json({ error: "settings object is required" }, { status: 400 });
    }

    const updated = await updateConnectionSettings(organizationId, provider, body.settings);
    if (!updated) return NextResponse.json({ error: "Not connected" }, { status: 409 });

    await logOrgEvent({
      organizationId,
      actorId: userId,
      action: "accounting_connected",
      metadata: { provider, settingsChanged: Object.keys(body.settings) },
    });

    return NextResponse.json({ settings: updated.settings });
  } catch (err) {
    if (err instanceof AccountingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: accountingErrorToStatus(err) }
      );
    }
    return crmErrorResponse(err);
  }
}

/** DELETE — disconnect. Deactivates; invoice history stays readable. */
export async function DELETE(req: NextRequest) {
  const guard = await requireCrmOrg(req);
  if (!guard.ok) return guard.response;
  const { userId, organizationId } = guard.ctx;

  const provider = req.nextUrl.searchParams.get("provider") as AccountingProvider | null;
  if (!provider || !ACCOUNTING_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "provider query parameter is required" }, { status: 400 });
  }

  try {
    await assertPermission(userId, organizationId, "manage_integrations");
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: teamErrorToStatus(err) }
      );
    }
    throw err;
  }

  const removed = await disconnectAccounting(organizationId, provider);
  if (removed) {
    await logOrgEvent({
      organizationId,
      actorId: userId,
      action: "accounting_disconnected",
      metadata: { provider },
    });
  }
  return NextResponse.json({ ok: true, disconnected: removed });
}
