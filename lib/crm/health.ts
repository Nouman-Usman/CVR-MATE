import { db } from "@/db";
import { crmConnection } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getValidToken } from "./token-manager";
import type { CrmProvider } from "./types";

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  provider: CrmProvider;
  error?: string;
}

/**
 * Lightweight health check — makes a small read-only API call
 * to verify the connection is alive and the token is valid.
 */
export async function checkConnectionHealth(
  connectionId: string,
  provider: CrmProvider
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const tokens = await getValidToken(connectionId);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    };

    // LeadConnector requires a Version header on all requests
    if (provider === "leadconnector") {
      headers.Version = "2021-07-28";
    }

    let healthUrl: string;
    switch (provider) {
      case "hubspot":
        // Lightweight: fetch account info
        healthUrl = "https://api.hubapi.com/account-info/v3/details";
        break;
      case "leadconnector":
        // Lightweight: fetch location details
        healthUrl = `https://services.leadconnectorhq.com/locations/${tokens.instanceUrl}`;
        break;
      case "pipedrive":
        // Lightweight: fetch current user
        healthUrl = "https://api.pipedrive.com/v1/users/me";
        break;
    }

    const res = await fetch(healthUrl, { headers, signal: AbortSignal.timeout(10_000) });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      // Mark inactive if auth permanently failed
      if (res.status === 401 || res.status === 403) {
        await db
          .update(crmConnection)
          .set({ isActive: false })
          .where(eq(crmConnection.id, connectionId));
      }

      return {
        healthy: false,
        latencyMs,
        provider,
        error: `API returned ${res.status}`,
      };
    }

    // Update last refreshed timestamp
    await db
      .update(crmConnection)
      .set({ lastRefreshedAt: new Date() })
      .where(eq(crmConnection.id, connectionId));

    return { healthy: true, latencyMs, provider };
  } catch (err) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      provider,
      error: err instanceof Error ? err.message : "Health check failed",
    };
  }
}
