import { NextRequest } from "next/server";
import { db } from "@/db";
import { apiKey } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthContext, handleAuthError } from "@/lib/auth-context";
import { generateApiKey } from "@/lib/api-key-auth";
import { logApiKeyCreated, logApiKeyRevoked } from "@/lib/audit";

// GET /api/admin/api-keys — list API keys for the org
export async function GET() {
  try {
    const { orgId } = await getAuthContext({ resource: "api_keys", action: "read" });

    const keys = await db.query.apiKey.findMany({
      where: eq(apiKey.organizationId, orgId),
      orderBy: [desc(apiKey.createdAt)],
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        isActive: true,
        rateLimit: true,
        createdAt: true,
      },
    });

    return Response.json({ keys });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/admin/api-keys — create a new API key
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await getAuthContext({ resource: "api_keys", action: "create" });

    const body = await request.json();
    const { name, scopes, expiresIn } = body as {
      name: string;
      scopes?: string[];
      expiresIn?: string; // '30d' | '90d' | '365d' | 'never'
    };

    if (!name?.trim()) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    const { plaintext, hash, prefix } = generateApiKey();

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (expiresIn && expiresIn !== "never") {
      const days = parseInt(expiresIn);
      if (!isNaN(days)) {
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
    }

    const [key] = await db
      .insert(apiKey)
      .values({
        organizationId: orgId,
        name: name.trim(),
        keyHash: hash,
        keyPrefix: prefix,
        scopes: scopes ?? ["read"],
        expiresAt,
        createdByUserId: userId,
      })
      .returning({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      });

    await logApiKeyCreated(userId, orgId, prefix, name.trim());

    // Return the plaintext key — shown only once
    return Response.json({ key: { ...key, plaintext } }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

// PATCH /api/admin/api-keys — rotate an API key (revoke old, create new with same config)
export async function PATCH(request: NextRequest) {
  try {
    const { userId, orgId } = await getAuthContext({ resource: "api_keys", action: "create" });

    const body = await request.json();
    const { keyId } = body as { keyId: string };

    if (!keyId) {
      return Response.json({ error: "keyId is required" }, { status: 400 });
    }

    // Find the existing key
    const existing = await db.query.apiKey.findFirst({
      where: and(eq(apiKey.id, keyId), eq(apiKey.organizationId, orgId), eq(apiKey.isActive, true)),
    });

    if (!existing) {
      return Response.json({ error: "Active API key not found" }, { status: 404 });
    }

    // Revoke the old key
    await db
      .update(apiKey)
      .set({ isActive: false })
      .where(eq(apiKey.id, keyId));

    await logApiKeyRevoked(userId, orgId, existing.keyPrefix);

    // Generate a new key with the same config
    const { plaintext, hash, prefix } = generateApiKey();

    const [newKey] = await db
      .insert(apiKey)
      .values({
        organizationId: orgId,
        name: existing.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: existing.scopes as string[],
        expiresAt: existing.expiresAt,
        createdByUserId: userId,
      })
      .returning({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      });

    await logApiKeyCreated(userId, orgId, prefix, existing.name);

    return Response.json({ key: { ...newKey, plaintext } });
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE /api/admin/api-keys — revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const { userId, orgId } = await getAuthContext({ resource: "api_keys", action: "delete" });

    const url = new URL(request.url);
    const keyId = url.searchParams.get("keyId");

    if (!keyId) {
      return Response.json({ error: "keyId is required" }, { status: 400 });
    }

    const existing = await db.query.apiKey.findFirst({
      where: and(eq(apiKey.id, keyId), eq(apiKey.organizationId, orgId)),
      columns: { keyPrefix: true },
    });

    if (!existing) {
      return Response.json({ error: "API key not found" }, { status: 404 });
    }

    await db
      .update(apiKey)
      .set({ isActive: false })
      .where(eq(apiKey.id, keyId));

    await logApiKeyRevoked(userId, orgId, existing.keyPrefix);

    return Response.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
