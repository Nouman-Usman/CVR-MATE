import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  validateActiveOrg,
  assertOrgPlanActive,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";

/**
 * The single enforced entry point for every native-CRM route.
 *
 * There is NO database-level RLS in this app (RLS is enabled with no policies
 * and the app connects as a superuser that bypasses it — see
 * drizzle/0022_enable_rls_all_tables.sql). Tenant isolation therefore rests
 * entirely on application-layer filtering. Every CRM route MUST:
 *   1. call `requireCrmOrg` first and bail on `!ok`,
 *   2. filter every query by the returned `organizationId`,
 *   3. never trust a client-supplied org/pipeline/stage/contact/deal id — on
 *      `[id]` routes, re-load the row and assert `row.organizationId === ctx
 *      .organizationId` before acting (IDOR defense).
 */
export interface CrmOrgContext {
  userId: string;
  organizationId: string;
}

export type CrmGuardResult =
  | { ok: true; ctx: CrmOrgContext }
  | { ok: false; response: NextResponse };

export async function requireCrmOrg(req: NextRequest): Promise<CrmGuardResult> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const userId = session.user.id;

  // Resolves + verifies membership (never trusts session alone); returns null
  // if the user belongs to no org.
  const organizationId = await validateActiveOrg(
    userId,
    session.session?.activeOrganizationId
  );
  if (!organizationId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "CRM features require an active organization.", upgrade: true },
        { status: 403 }
      ),
    };
  }

  // Enterprise plan gate — CRM is a team/Enterprise feature.
  try {
    await assertOrgPlanActive(organizationId);
  } catch (err) {
    return { ok: false, response: crmErrorResponse(err) };
  }

  return { ok: true, ctx: { userId, organizationId } };
}

/**
 * Map an error thrown inside a CRM handler to a response. TeamPermissionError
 * maps via its code; everything else is a logged 500.
 */
export function crmErrorResponse(err: unknown): NextResponse {
  if (err instanceof TeamPermissionError) {
    return NextResponse.json(
      { error: err.message, upgrade: err.code === "PLAN_NOT_ALLOWED" },
      { status: teamErrorToStatus(err) }
    );
  }
  console.error("[crm] Unhandled route error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
