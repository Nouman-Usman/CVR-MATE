import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { requireCrmOrg } from "@/lib/crm/guard";
import { assertPermission, TeamPermissionError } from "@/lib/team/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  GRANT_STATE_COOKIE,
  GRANT_STATE_TTL_SECONDS,
  signGrantState,
} from "@/lib/accounting/grant-state";

export const runtime = "nodejs";

/** e-conomic's request-access page. Not an OAuth authorize endpoint. */
const REQUEST_ACCESS_URL = "https://secure.e-conomic.com/secure/api1/requestaccess.aspx";

function settings(baseUrl: string, error: string) {
  return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=${error}`);
}

/**
 * GET /api/accounting/economic/start — begin the e-conomic grant flow.
 *
 * The user clicks Connect, we send them to e-conomic, they approve the app
 * against their agreement, and e-conomic redirects back to our callback with
 * the agreement grant token. No token is ever typed or pasted.
 *
 * This is e-conomic's own flow, not OAuth 2.0: there is no client secret
 * exchange and no `state` parameter that the provider echoes back. The
 * anti-forgery value therefore lives in a signed HttpOnly cookie — see
 * `lib/accounting/grant-state.ts`.
 */
export async function GET(req: NextRequest) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";

  const guard = await requireCrmOrg(req);
  // A redirect target, not an API caller: send them somewhere they can read
  // rather than returning JSON into a browser address bar.
  if (!guard.ok) return settings(baseUrl, "not_authorized");
  const { userId, organizationId } = guard.ctx;

  const rl = await checkRateLimit(userId, "accounting_connect_start", 10, 3600);
  if (!rl.allowed) return settings(baseUrl, "rate_limited");

  try {
    await assertPermission(userId, organizationId, "manage_integrations");
  } catch (err) {
    if (err instanceof TeamPermissionError) return settings(baseUrl, "forbidden");
    throw err;
  }

  const appPublicToken = process.env.ECONOMIC_APP_PUBLIC_TOKEN;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!appPublicToken || !secret) {
    // Misconfiguration, not user error — say so plainly rather than sending the
    // user to e-conomic to fail there.
    return settings(baseUrl, "economic_not_configured");
  }

  const state = signGrantState(
    {
      organizationId,
      userId,
      exp: Math.floor(Date.now() / 1000) + GRANT_STATE_TTL_SECONDS,
    },
    secret
  );

  const cookieStore = await cookies();
  cookieStore.set(GRANT_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not Strict: the cookie must survive the top-level navigation back
    // from e-conomic. Strict would drop it and every connect would fail.
    sameSite: "lax",
    path: "/api/accounting/economic",
    maxAge: GRANT_STATE_TTL_SECONDS,
  });

  const redirectUrl = `${baseUrl}/api/accounting/economic/callback`;
  const target = `${REQUEST_ACCESS_URL}?appPublicToken=${encodeURIComponent(
    appPublicToken
  )}&redirectUrl=${encodeURIComponent(redirectUrl)}`;

  return NextResponse.redirect(target);
}
