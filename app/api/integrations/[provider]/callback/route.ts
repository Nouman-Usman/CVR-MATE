import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { crmConnection } from "@/db/schema";
import { encrypt } from "@/lib/crm/encryption";
import { CRM_PROVIDERS, type CrmProvider } from "@/lib/crm/types";

// GET /api/integrations/[provider]/callback — handle OAuth callback
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.redirect(`${baseUrl}/login`);
    }

    const { provider } = await params;
    const config = CRM_PROVIDERS[provider as CrmProvider];
    if (!config) {
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_provider`);
    }

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=${error}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=missing_params`);
    }

    // Verify state
    const cookieStore = await cookies();
    const storedState = cookieStore.get(`crm_oauth_state_${provider}`)?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=invalid_state`);
    }
    cookieStore.delete(`crm_oauth_state_${provider}`);

    // Exchange code for tokens
    const clientId = process.env[config.clientIdEnv]!;
    const clientSecret = process.env[config.clientSecretEnv]!;
    const redirectUri = `${baseUrl}/api/integrations/${provider}/callback`;

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`Token exchange failed for ${provider}:`, errText);
      return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const expiresIn = tokens.expires_in as number | undefined;
    // LeadConnector returns locationId — stored in instanceUrl column for API routing
    const instanceUrl = (tokens.locationId as string) ?? (tokens.instance_url as string) ?? undefined;

    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    // Upsert connection
    const existing = await db.query.crmConnection.findFirst({
      where: and(
        eq(crmConnection.userId, session.user.id),
        eq(crmConnection.provider, provider)
      ),
    });

    if (existing) {
      await db
        .update(crmConnection)
        .set({
          accessToken: encrypt(accessToken),
          refreshToken: refreshToken ? encrypt(refreshToken) : existing.refreshToken,
          tokenExpiresAt,
          instanceUrl: instanceUrl ?? existing.instanceUrl,
          isActive: true,
          connectedAt: new Date(),
          lastRefreshedAt: new Date(),
        })
        .where(eq(crmConnection.id, existing.id));
    } else {
      await db.insert(crmConnection).values({
        userId: session.user.id,
        provider,
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt,
        instanceUrl: instanceUrl ?? null,
        scopes: config.scopes || null,
        isActive: true,
      });
    }

    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&connected=${provider}`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=callback_failed`);
  }
}
