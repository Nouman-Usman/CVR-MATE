import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getCompanyByVat } from "@/lib/cvr-api";
import { traverseOwnership } from "@/lib/ownership/traverse";
import { DEFAULT_TRAVERSE_OPTIONS, OWNERSHIP_LIMITS } from "@/lib/ownership/types";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkEntitlement } from "@/lib/stripe/entitlements";

export const runtime = "nodejs";

/**
 * GET the ownership graph around a company.
 *
 *   /api/cvr/ownership?vat=24256790&up=2&down=1&management=1
 *
 * Traversal runs here rather than in the browser: each hop is a separate CVR
 * lookup, `/api/cvr/company` allows 60/min, and a depth-2 graph off a holding
 * company is easily 100+ requests. One server call, breadth-first, riding the
 * Redis cache inside `getCompanyByVat`, is the only shape that works.
 *
 * Gated on the `ownershipDiagram` entitlement (Professional + Enterprise).
 * Unlike the match feed — which returns an empty list so the UI can render a
 * teaser — this returns 403: the graph is the whole feature, and an empty one
 * would read as "this company has no owners".
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkEntitlement(session.user.id, "ownershipDiagram");
    if (!gate.allowed) {
      return NextResponse.json(
        {
          error: "The ownership diagram requires the Professional plan.",
          upgrade: true,
          plan: gate.plan,
        },
        { status: 403 }
      );
    }

    // One graph fans out to many upstream lookups, so this is deliberately
    // tighter than the 60/min on single-company lookups.
    const rl = await checkRateLimit(session.user.id, "cvr_ownership_graph", 20, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Maximum 20 ownership graphs per minute." },
        { status: 429 }
      );
    }

    const vat = req.nextUrl.searchParams.get("vat");
    if (!vat || !/^\d{8}$/.test(vat)) {
      return NextResponse.json(
        { error: "Valid 8-digit CVR number is required" },
        { status: 400 }
      );
    }

    const params = req.nextUrl.searchParams;
    const graph = await traverseOwnership(getCompanyByVat, Number(vat), {
      up: depthParam(params.get("up"), DEFAULT_TRAVERSE_OPTIONS.up),
      down: depthParam(params.get("down"), DEFAULT_TRAVERSE_OPTIONS.down),
      // Management is on unless explicitly switched off, matching the panel's
      // default. `management=0` is how the client asks for the ownership spine.
      includeManagement: params.get("management") !== "0",
    });

    return NextResponse.json({ graph });
  } catch (error) {
    console.error("CVR ownership graph error:", error);
    const message = error instanceof Error ? error.message : "Ownership lookup failed";
    // Only the ROOT company's failure reaches here — a failed branch is
    // reported inside `graph.errors` and still returns 200 with a usable graph.
    const status = message.includes("404") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Clamp a depth query param; anything unparseable falls back to the default. */
function depthParam(raw: string | null, fallback: number): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.floor(n), OWNERSHIP_LIMITS.maxDepth);
}
