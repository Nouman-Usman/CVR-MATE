import type { CvrCompany, CvrParticipantRole, CvrParticipation, CvrRole } from "@/lib/cvr-api";

import {
  OWNERSHIP_LIMITS,
  companyNodeId,
  edgeKindForRole,
  isTraversable,
  personNodeId,
  type Direction,
  type EdgeKind,
  type OwnershipEdge,
  type OwnershipGraph,
  type OwnershipNode,
  type OwnershipNodeId,
  type TraverseOptions,
  type Truncation,
} from "./types";

/**
 * Breadth-first ownership traversal.
 *
 * Deliberately takes its fetcher as an argument rather than importing
 * `getCompanyByVat`. Two reasons: the whole thing becomes testable against a
 * stub with no network, and the caller decides what caching the fetch has.
 * Every failure mode worth worrying about here — cycles, fan-out, the
 * management-explosion, the P-unit trap — is invisible in a screenshot but
 * trivial to assert against a fixture.
 *
 * Client-safe by construction (no `server-only`, no db, no fetch).
 */
export type FetchCompany = (vat: number) => Promise<CvrCompany>;

interface QueueItem {
  vat: number;
  nodeId: OwnershipNodeId;
  depth: number;
  direction: Direction;
}

/** A relation we decided to draw, before we know whether we can expand it. */
interface Relation {
  nodeId: OwnershipNodeId;
  node: OwnershipNode;
  edge: OwnershipEdge;
  /** Set when the far side is a company we could walk to. */
  vat?: number;
}

export async function traverseOwnership(
  fetchCompany: FetchCompany,
  rootVat: number,
  options: TraverseOptions
): Promise<OwnershipGraph> {
  const maxNodes = options.maxNodes ?? OWNERSHIP_LIMITS.maxNodes;
  const maxFanout = options.maxFanout ?? OWNERSHIP_LIMITS.maxFanout;
  const up = clampDepth(options.up);
  const down = clampDepth(options.down);

  // The root is fetched outside the loop: if the subject company itself cannot
  // be loaded there is no graph to degrade to, so that error propagates.
  const rootCompany = await fetchCompany(rootVat);
  const rootId = companyNodeId(rootVat);

  const nodes = new Map<OwnershipNodeId, OwnershipNode>();
  const edges = new Map<string, OwnershipEdge>();
  const truncated: Truncation[] = [];
  const errors: OwnershipGraph["errors"] = [];

  nodes.set(rootId, {
    ...nodeFromCompany(rootCompany),
    depth: 0,
    direction: "root",
  });

  // Keyed on node id, which is what makes cross-ownership terminate: A owns B,
  // B owns A is a normal Danish holding shape, and a walk without this never
  // returns. `expanded` is separate from `nodes` — a node can be drawn (we know
  // it exists from its parent's payload) long before, or without ever, being
  // fetched.
  const expanded = new Set<string>();
  const companyCache = new Map<number, CvrCompany>([[rootVat, rootCompany]]);

  let queue: QueueItem[] = [];
  if (up > 0) queue.push({ vat: rootVat, nodeId: rootId, depth: 0, direction: "up" });
  if (down > 0) queue.push({ vat: rootVat, nodeId: rootId, depth: 0, direction: "down" });

  while (queue.length > 0) {
    // Process a level at a time, bounded concurrency, so one slow lookup does
    // not serialise the whole graph.
    const level = queue;
    queue = [];

    for (const batch of chunk(level, OWNERSHIP_LIMITS.concurrency)) {
      const settled = await Promise.allSettled(
        batch.map(async (item) => ({
          item,
          company: await loadCompany(item.vat),
        }))
      );

      for (let i = 0; i < settled.length; i++) {
        const result = settled[i];
        const item = batch[i];

        if (result.status === "rejected") {
          // A dead branch must not fail the whole request — the node stays on
          // the canvas, it just cannot be expanded.
          errors.push({ nodeId: item.nodeId, message: messageOf(result.reason) });
          markHasMore(nodes, item.nodeId);
          continue;
        }

        const { company } = result.value;
        const maxDepth = item.direction === "up" ? up : down;

        const relations =
          item.direction === "up"
            ? relationsUp(company, item, options.includeManagement)
            : relationsDown(company, item);

        const kept = relations.slice(0, maxFanout);
        if (relations.length > kept.length) {
          truncated.push({
            nodeId: item.nodeId,
            direction: item.direction,
            reason: "fanout",
            omitted: relations.length - kept.length,
          });
          markHasMore(nodes, item.nodeId);
        }

        for (const rel of kept) {
          const isNewNode = !nodes.has(rel.nodeId);

          if (isNewNode && nodes.size >= maxNodes) {
            // Budget exhausted. Report once per node rather than once per
            // dropped relation — the count is meaningless past this point.
            if (!truncated.some((t) => t.nodeId === item.nodeId && t.reason === "node_budget")) {
              truncated.push({
                nodeId: item.nodeId,
                direction: item.direction,
                reason: "node_budget",
                omitted: null,
              });
              markHasMore(nodes, item.nodeId);
            }
            continue;
          }

          if (isNewNode) nodes.set(rel.nodeId, rel.node);
          edges.set(rel.edge.id, rel.edge);

          // Management is terminal. This single condition is what keeps a
          // 12-node graph from becoming hundreds: one director of a large A/S
          // sits on twenty boards.
          if (!isTraversable(rel.edge.kind) || rel.vat == null) continue;

          const nextDepth = item.depth + 1;
          const expandKey = `${rel.nodeId}:${item.direction}`;

          if (nextDepth >= maxDepth) {
            // Frontier, not truncation: we never looked, so there is nothing
            // to count. `hasMore` says "unexpanded", which is all we know.
            markHasMore(nodes, rel.nodeId);
            continue;
          }

          if (expanded.has(expandKey)) continue;
          expanded.add(expandKey);

          queue.push({
            vat: rel.vat,
            nodeId: rel.nodeId,
            depth: nextDepth,
            // Direction never flips mid-walk. Following a parent's other
            // holdings downward, then those holdings' owners upward, fans out
            // across the whole register within three hops.
            direction: item.direction,
          });
        }
      }
    }
  }

  return {
    rootId,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    truncated,
    errors,
  };

  async function loadCompany(vat: number): Promise<CvrCompany> {
    const hit = companyCache.get(vat);
    if (hit) return hit;
    const fetched = await fetchCompany(vat);
    companyCache.set(vat, fetched);
    return fetched;
  }
}

// ─── Relation extraction ────────────────────────────────────────────────────

/**
 * Who owns or serves this company. Note what is NOT read here:
 * `company.subsidiaries` — those are produktionsenheder that repeat the
 * company's own VAT, so drawing them would make a company own itself 220 times.
 */
function relationsUp(
  company: CvrCompany,
  item: QueueItem,
  includeManagement: boolean
): Relation[] {
  const out: Relation[] = [];

  for (const party of company.participants ?? []) {
    const partyId = participantNodeId(party);
    if (!partyId) continue;

    for (const role of party.roles ?? []) {
      const kind = edgeKindForRole(role.type);
      if (!kind) continue;
      if (kind === "management" && !includeManagement) continue;
      if (hasEnded(role)) continue;

      out.push({
        nodeId: partyId,
        vat: party.vat,
        node: {
          id: partyId,
          kind: party.vat != null ? "company" : "person",
          name: party.life?.name ?? "—",
          vat: party.vat,
          participantNumber: party.participantnumber,
          companyForm: party.companyform?.longdescription ?? party.companyform?.description ?? null,
          status: party.companystatus?.text ?? null,
          adProtected: party.life?.adprotected ?? false,
          depth: item.depth + 1,
          direction: "up",
        },
        // The actor owns/serves the company being expanded.
        edge: buildEdge(partyId, item.nodeId, kind, role),
      });
    }
  }

  return out;
}

/** What this company owns. Management is meaningless downward — a company does
 *  not sit on another company's board in the participations feed. */
function relationsDown(company: CvrCompany, item: QueueItem): Relation[] {
  const out: Relation[] = [];

  for (const held of company.participations ?? []) {
    if (held.vat == null) continue;
    const heldId = companyNodeId(held.vat);

    for (const role of held.roles ?? []) {
      if (edgeKindForRole(role.type) !== "ownership") continue;
      if (hasEnded(role)) continue;

      out.push({
        nodeId: heldId,
        vat: held.vat,
        node: nodeFromParticipation(held, item.depth + 1),
        edge: buildEdge(item.nodeId, heldId, "ownership", role),
      });
    }
  }

  return out;
}

// ─── Builders ───────────────────────────────────────────────────────────────

function buildEdge(
  from: OwnershipNodeId,
  to: OwnershipNodeId,
  kind: EdgeKind,
  role: CvrRole
): OwnershipEdge {
  const base = {
    // Role type is part of the id so founder-AND-owner produces two edges
    // rather than one silently overwriting the other.
    id: `${from}->${to}:${role.type}`,
    from,
    to,
    kind,
    roleType: role.type,
    since: role.life?.start ?? null,
  };

  if (kind === "management") {
    // No percentage: a board seat is not a stake. The renderer puts the title
    // where ownership puts its number.
    return { ...base, roleTitle: role.life?.title ?? null };
  }

  const ownership = normalisePercent(role.life?.owner_percent);
  const voting = normalisePercent(role.life?.owner_voting_percent);

  return {
    ...base,
    ownershipPercent: ownership,
    votingPercent: voting,
    capitalClasses: role.life?.owner_capital_classes ?? null,
  };
}

function nodeFromCompany(company: CvrCompany): Omit<OwnershipNode, "depth" | "direction"> {
  return {
    id: companyNodeId(company.vat),
    kind: "company",
    name: company.life?.name ?? String(company.vat),
    vat: company.vat,
    companyForm: company.companyform?.longdescription ?? company.companyform?.description ?? null,
    status: company.companystatus?.text ?? null,
    adProtected: company.life?.adprotected ?? false,
  };
}

function nodeFromParticipation(held: CvrParticipation, depth: number): OwnershipNode {
  return {
    id: companyNodeId(held.vat),
    kind: "company",
    name: held.life?.name ?? String(held.vat),
    vat: held.vat,
    companyForm: held.companyform?.longdescription ?? held.companyform?.description ?? null,
    status: held.companystatus?.text ?? null,
    adProtected: held.life?.adprotected ?? false,
    depth,
    direction: "down",
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function participantNodeId(party: CvrParticipantRole): OwnershipNodeId | null {
  if (party.vat != null) return companyNodeId(party.vat);
  if (party.participantnumber != null) return personNodeId(party.participantnumber);
  return null;
}

/** A non-null `end` means the role is historical. Drawing former owners beside
 *  current ones would state something false about who controls the company. */
function hasEnded(role: CvrRole): boolean {
  return role.life?.end != null;
}

/**
 * cvrapi.dk reports a PERCENT (0–100). The CVR distribution reports the same
 * concept as a FRACTION (0.6667). Mixing the two renders a two-thirds stake as
 * "0.67%" and looks entirely plausible, so this function exists to keep the
 * assumption in one auditable place — it does not convert.
 */
function normalisePercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
}

function markHasMore(nodes: Map<OwnershipNodeId, OwnershipNode>, id: OwnershipNodeId): void {
  const node = nodes.get(id);
  if (node) node.hasMore = true;
}

function clampDepth(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), OWNERSHIP_LIMITS.maxDepth);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
