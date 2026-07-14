import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pipeline, pipelineStage, deal } from "@/db/schema";

/** Deal lifecycle status, derived from the stage a deal sits in. */
export type DealStatus = "open" | "won" | "lost";

export interface StageFlags {
  isWon: boolean;
  isLost: boolean;
}

/**
 * Derive a deal's status from its current stage. A stage cannot be both won and
 * lost; if mis-configured, won wins.
 */
export function deriveStatusFromStage(stage: StageFlags): DealStatus {
  if (stage.isWon) return "won";
  if (stage.isLost) return "lost";
  return "open";
}

/** Default stage set seeded for a new org's first pipeline. */
export const DEFAULT_STAGES: Array<{
  name: string;
  color: string;
  isWon?: boolean;
  isLost?: boolean;
}> = [
  { name: "Prospect", color: "#94a3b8" },
  { name: "Contacted", color: "#60a5fa" },
  { name: "Qualified", color: "#a78bfa" },
  { name: "Proposal", color: "#fbbf24" },
  { name: "Won", color: "#34d399", isWon: true },
  { name: "Lost", color: "#f87171", isLost: true },
];

export type PipelineWithStages = typeof pipeline.$inferSelect & {
  stages: (typeof pipelineStage.$inferSelect)[];
};

async function findDefaultWithStages(
  organizationId: string
): Promise<PipelineWithStages | null> {
  const row = await db.query.pipeline.findFirst({
    where: and(eq(pipeline.organizationId, organizationId), eq(pipeline.isDefault, true)),
    with: { stages: { orderBy: [asc(pipelineStage.position)] } },
  });
  return (row as PipelineWithStages | undefined) ?? null;
}

/**
 * Return the org's default pipeline (with ordered stages), creating it + the
 * default stages on first access. Race-safe: the partial unique index on
 * (organizationId) WHERE is_default guarantees a single default, and a
 * concurrent creation is recovered by re-selecting.
 */
export async function getOrCreateDefaultPipeline(
  organizationId: string,
  userId: string
): Promise<PipelineWithStages> {
  const existing = await findDefaultWithStages(organizationId);
  if (existing) return existing;

  try {
    return await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(pipeline)
        .values({ organizationId, name: "Sales Pipeline", isDefault: true, createdBy: userId })
        .returning();
      await tx.insert(pipelineStage).values(
        DEFAULT_STAGES.map((s, i) => ({
          pipelineId: p.id,
          organizationId,
          name: s.name,
          position: i,
          color: s.color,
          isWon: s.isWon ?? false,
          isLost: s.isLost ?? false,
        }))
      );
      const stages = await tx.query.pipelineStage.findMany({
        where: eq(pipelineStage.pipelineId, p.id),
        orderBy: [asc(pipelineStage.position)],
      });
      return { ...p, stages };
    });
  } catch (err) {
    // Another request likely created the default concurrently — re-select.
    const again = await findDefaultWithStages(organizationId);
    if (again) return again;
    throw err;
  }
}

// ─── Ownership helpers (IDOR defense — no DB-level RLS) ─────────────────────

/** Load a pipeline only if it belongs to the given org, else null. */
export async function loadOwnedPipeline(id: string, organizationId: string) {
  const row = await db.query.pipeline.findFirst({ where: eq(pipeline.id, id) });
  return row && row.organizationId === organizationId ? row : null;
}

/** Load a stage only if it belongs to the given org, else null. */
export async function loadOwnedStage(id: string, organizationId: string) {
  const row = await db.query.pipelineStage.findFirst({ where: eq(pipelineStage.id, id) });
  return row && row.organizationId === organizationId ? row : null;
}

/** Load a non-deleted deal only if it belongs to the given org, else null. */
export async function loadOwnedDeal(id: string, organizationId: string) {
  const row = await db.query.deal.findFirst({ where: eq(deal.id, id) });
  return row && row.organizationId === organizationId && !row.deletedAt ? row : null;
}
