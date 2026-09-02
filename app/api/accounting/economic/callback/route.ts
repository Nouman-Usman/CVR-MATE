import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { auth } from "@/lib/auth";
import { assertPermission, TeamPermissionError } from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { connectAccounting } from "@/lib/accounting/connection";
import { AccountingError } from "@/lib/accounting/types";
import { GRANT_STATE_COOKIE, verifyGrantState } from "@/lib/accounting/grant-state";

export const runtime = "nodejs";

/**
 * GET /api/accounting/economic/callback — receive the agreement grant token.
 *
 * Three things this route is careful about:
 *
 *  1. **The token is in the URL.** e-conomic appends it as a query parameter,
 *     which means it lands in browser history and any access log that records
 *     query strings. It is therefore consumed immediately and the response is a
 *     redirect to a clean URL; the token is never echoed, logged, or put in a
 *     response body.
 *  2. **The cookie says what was intended, not what is allowed.** The signed
 *     state proves which org started the flow, but permission is re-asserted
 *     against the live session — a user whose role changed mid-flow must not
 *     slip through on a cookie minted a minute ago.
 *  3. **Every failure looks the same to the browser**: a redirect to Settings
 *     with a short error code. No stack traces, no provider detail in the URL.
 */
export async function GET(req: NextRequest) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const back = (params: string) =>
    NextResponse.redirect(`${baseUrl}/settings?tab=integrations&${params}`);

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(GRANT_STATE_COOKIE)?.value;
  // Cleared unconditionally: a single-use value that survives a failed attempt
  // is a replay window.
  cookieStore.delete({ name: GRANT_STATE_COOKIE, path: "/api/accounting/economic" });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.redirect(`${baseUrl}/login`);

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return back("error=economic_not_configured");

  const verified = verifyGrantState(stateCookie, secret);
  if (!verified.ok) return back(`error=invalid_state&reason=${verified.reason}`);

  // The flow must finish in the same session that started it.
  if (verified.state.userId !== session.user.id) return back("error=invalid_state");

  // e-conomic's parameter name is `token`; accept the longer spelling too rather
  // than failing the whole flow on a naming difference.
  const grantToken =
    req.nextUrl.searchParams.get("token") ??
    req.nextUrl.searchParams.get("agreementGrantToken");
  if (!grantToken) {
    const denied = req.nextUrl.searchParams.get("error");
    return back(denied ? "error=access_denied" : "error=missing_token");
  }

  const organizationId = verified.state.organizationId;

  try {
    // Re-check against the live session, not the cookie.
    await assertPermission(session.user.id, organizationId, "manage_integrations");
  } catch (err) {
    if (err instanceof TeamPermissionError) return back("error=forbidden");
    throw err;
  }

  try {
    // Verifies the grant and reads the agreement's defaults in one step, so the
    // user lands on a connection that is already configured.
    const { connection, complete } = await connectAccounting({
      organizationId,
      userId: session.user.id,
      provider: "economic",
      accessToken: grantToken,
    });

    await logOrgEvent({
      organizationId,
      actorId: session.user.id,
      action: "accounting_connected",
      metadata: { provider: "economic", agreementName: connection.agreementName, via: "grant_flow" },
    });

    return back(complete ? "connected=economic" : "connected=economic&review=1");
  } catch (err) {
    if (err instanceof AccountingError) {
      // The code is safe to show; the provider's detail is not, and stays in the
      // connection row rather than the URL.
      return back(`error=${encodeURIComponent(err.code.toLowerCase())}`);
    }
    console.error("[accounting/economic/callback] Failed to connect");
    return back("error=connect_failed");
  }
}
