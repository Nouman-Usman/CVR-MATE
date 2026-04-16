import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { crmConnection } from "@/db/schema";
import { CRM_PROVIDERS, type CrmProvider } from "@/lib/crm/types";
import { checkEntitlement, checkUsageEntitlement } from "@/lib/stripe/entitlements";

// GET /api/integrations/[provider]/connect — initiate OAuth flow
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, plan } = await checkEntitlement(session.user.id, "crm");
    if (!allowed) {
      return NextResponse.json(
        { error: "CRM integrations require Professional or Enterprise plan", upgrade: true, plan },
        { status: 403 }
      );
    }

    const { provider } = await params;
    const config = CRM_PROVIDERS[provider as CrmProvider];
    if (!config) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const clientId = process.env[config.clientIdEnv];
    if (!clientId) {
      return NextResponse.json({ error: `${provider} not configured` }, { status: 500 });
    }

    // Enforce connection limit per plan tier
    const activeConnections = await db.query.crmConnection.findMany({
      where: and(
        eq(crmConnection.userId, session.user.id),
        eq(crmConnection.isActive, true)
      ),
    });

    // Allow reconnecting to same provider (re-auth) without counting toward limit
    const isReconnect = activeConnections.some(c => c.provider === provider);
    if (!isReconnect) {
      const { allowed: canAdd, limit } = await checkUsageEntitlement(
        session.user.id,
        "crmConnections",
        activeConnections.length
      );
      if (!canAdd) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
        return NextResponse.redirect(
          `${baseUrl}/settings?tab=integrations&error=connection_limit&limit=${limit}&current=${activeConnections.length}`
        );
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/integrations/${provider}/callback`;

    // Generate state token for CSRF protection
    const state = randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(`crm_oauth_state_${provider}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });

    if (config.scopes) {
      authParams.set("scope", config.scopes);
    }

    const authUrl = `${config.authUrl}?${authParams.toString()}`;
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("OAuth connect error:", error);
    return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
  }
}
