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

    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    };

    let healthUrl: string;
    switch (provider) {
      case "hubspot":
        // Lightweight: fetch account info
        healthUrl = "https://api.hubapi.com/account-info/v3/details";
        break;
      case "salesforce":
        // Lightweight: fetch org limits
        healthUrl = `${tokens.instanceUrl}/services/data/v59.0/limits`;
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
