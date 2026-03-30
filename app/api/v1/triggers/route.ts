import { NextRequest } from "next/server";
import { db } from "@/db";
import { leadTrigger, triggerResult } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { validateApiKey, requireScope, handleApiKeyError } from "@/lib/api-key-auth";

// GET /api/v1/triggers — list triggers + recent results
export async function GET(request: NextRequest) {
  try {
    const ctx = await validateApiKey(request.headers.get("authorization"));
    requireScope(ctx, "read");

    const triggers = await db.query.leadTrigger.findMany({
      where: eq(leadTrigger.organizationId, ctx.organizationId),
      orderBy: [desc(leadTrigger.createdAt)],
      with: {
        results: {
          limit: 5,
          orderBy: [desc(triggerResult.createdAt)],
          columns: {
            id: true,
            matchCount: true,
            createdAt: true,
          },
        },
      },
    });

    return Response.json({
      triggers: triggers.map((t) => ({
        id: t.id,
        name: t.name,
        filters: t.filters,
        frequency: t.frequency,
        isActive: t.isActive,
        nextRunAt: t.nextRunAt,
        lastRunAt: t.lastRunAt,
        recentResults: t.results,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    return handleApiKeyError(error);
  }
}

// POST /api/v1/triggers — create a new trigger
export async function POST(request: NextRequest) {
  try {
    const ctx = await validateApiKey(request.headers.get("authorization"));
    requireScope(ctx, "write");

    const body = await request.json();
    const { name, filters, frequency } = body as {
      name: string;
      filters: Record<string, unknown>;
      frequency?: string;
    };

    if (!name?.trim() || !filters) {
      return Response.json({ error: "name and filters are required" }, { status: 400 });
    }

    const [trigger] = await db
      .insert(leadTrigger)
      .values({
        userId: ctx.createdByUserId,
        organizationId: ctx.organizationId,
        name: name.trim(),
        filters,
        frequency: frequency ?? "daily",
      })
      .returning();

    return Response.json({ trigger }, { status: 201 });
  } catch (error) {
    return handleApiKeyError(error);
  }
}
