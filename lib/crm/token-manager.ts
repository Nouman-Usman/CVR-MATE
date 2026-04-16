import { db } from "@/db";
import { crmConnection } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";
import { CRM_PROVIDERS, type CrmProvider } from "./types";

interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  instanceUrl?: string;
}

export async function getValidToken(connectionId: string): Promise<TokenSet> {
  const conn = await db.query.crmConnection.findFirst({
    where: eq(crmConnection.id, connectionId),
  });
  if (!conn || !conn.isActive) throw new Error("CRM connection not found or inactive");

  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minute buffer

  // Check if token needs refresh
  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - buffer < now.getTime() && conn.refreshToken) {
    return refreshAccessToken(conn.id, conn.provider as CrmProvider, decrypt(conn.refreshToken), conn.instanceUrl);
  }

  return {
    accessToken: decrypt(conn.accessToken),
    refreshToken: conn.refreshToken ? decrypt(conn.refreshToken) : undefined,
    expiresAt: conn.tokenExpiresAt ?? undefined,
    instanceUrl: conn.instanceUrl ?? undefined,
  };
}

async function refreshAccessToken(
  connectionId: string,
  provider: CrmProvider,
  refreshToken: string,
  instanceUrl?: string | null
): Promise<TokenSet> {
  const config = CRM_PROVIDERS[provider];
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) throw new Error(`Missing OAuth credentials for ${provider}`);

  const tokenUrl = config.tokenUrl;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    // Mark connection as inactive if refresh fails permanently
    await db
      .update(crmConnection)
      .set({ isActive: false })
      .where(eq(crmConnection.id, connectionId));
    throw new Error(`Token refresh failed for ${provider}: ${errText}`);
  }

  const tokens = await res.json();
  const newAccessToken = tokens.access_token as string;
  const newRefreshToken = (tokens.refresh_token as string) || refreshToken;
  const expiresIn = tokens.expires_in as number | undefined;
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  const newInstanceUrl = (tokens.instance_url as string) || instanceUrl;

  await db
    .update(crmConnection)
    .set({
      accessToken: encrypt(newAccessToken),
      refreshToken: encrypt(newRefreshToken),
      tokenExpiresAt: expiresAt,
      instanceUrl: newInstanceUrl,
      lastRefreshedAt: new Date(),
    })
    .where(eq(crmConnection.id, connectionId));

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: expiresAt ?? undefined,
    instanceUrl: newInstanceUrl ?? undefined,
  };
}
