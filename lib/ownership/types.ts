
export const OWNERSHIP_ROLES = [
  "owner",
  "real_owner",
  "fully_responsible_participant",
] as const;

export const MANAGEMENT_ROLES = [
  "director",
  "board",
  "supervisory_board",
  "daily_management",
  "branch_manager",
  "founder",
  "liquidator",
  "accountant",
] as const;

export type OwnershipRole = (typeof OWNERSHIP_ROLES)[number];
export type ManagementRole = (typeof MANAGEMENT_ROLES)[number];

export type EdgeKind = "ownership" | "management";

const OWNERSHIP_SET: ReadonlySet<string> = new Set(OWNERSHIP_ROLES);
const MANAGEMENT_SET: ReadonlySet<string> = new Set(MANAGEMENT_ROLES);

/** Which edge kind a CVR role type produces, or null when we do not draw it. */
export function edgeKindForRole(roleType: string | null | undefined): EdgeKind | null {
  if (!roleType) return null;
  if (OWNERSHIP_SET.has(roleType)) return "ownership";
  if (MANAGEMENT_SET.has(roleType)) return "management";
  return null;
}

/** Only ownership edges are followed. Management is terminal, by design. */
export function isTraversable(kind: EdgeKind): boolean {
  return kind === "ownership";
}

// ─── Node identity ──────────────────────────────────────────────────────────

export type NodeKind = "company" | "person";

/**
 * `c:<vat>` or `p:<participantnumber>`. Keying the visited-set on this is what
 * makes cross-ownership terminate: Danish holding structures loop more often
 * than people expect, and a walk without a visited-set never returns.
 */
export type OwnershipNodeId = string;

export function companyNodeId(vat: number): OwnershipNodeId {
  return `c:${vat}`;
}

export function personNodeId(participantNumber: number): OwnershipNodeId {
  return `p:${participantNumber}`;
}

// ─── Graph ──────────────────────────────────────────────────────────────────

export interface OwnershipNode {
  id: OwnershipNodeId;
  kind: NodeKind;
  name: string;
  /** Companies only. */
  vat?: number;
  /** Persons only — the key for `/api/cvr/participant`. */
  participantNumber?: number;
  companyForm?: string | null;
  status?: string | null;
  /** Reklamebeskyttet — do not use for cold outreach. Carried so the renderer
   *  can mark it, the same way the company page already does. */
  adProtected?: boolean;
  /** Hop distance from the root. 0 is the subject company. */
  depth: number;
  /** Which way this node was reached. The root is `root`. */
  direction: Direction | "root";
  /**
   * This node was not fully expanded — we hit the depth limit, a cap, or its
   * lookup failed. It does NOT assert that more relations exist; it asserts
   * that we did not look. The renderer shows an "expand" affordance on it.
   */
  hasMore?: boolean;
}

export type Direction = "up" | "down";

export interface OwnershipEdge {
  id: string;
  /** The actor: the owner, or the person holding the role. */
  from: OwnershipNodeId;
  /** The company being owned or served. */
  to: OwnershipNodeId;
  kind: EdgeKind;
  /** Raw CVR role type, e.g. "owner", "board". */
  roleType: string;
  /** Management only — "Direktør", "Formand". Ownership edges carry no title. */
  roleTitle?: string | null;
  /** Ownership only — a PERCENT (0–100), never a fraction. */
  ownershipPercent?: number | null;
  /** Ownership only. Rendered only when it differs from `ownershipPercent`. */
  votingPercent?: number | null;
  capitalClasses?: string | null;
  since?: string | null;
}

/**
 * Relations we SAW and chose not to draw. Emitting this is not optional: a
 * silently capped graph reads as "this company owns nothing else", which is a
 * factual claim we would be making by omission.
 *
 * Reaching the depth limit is deliberately NOT truncation — there we never
 * looked, so there is nothing to count. That case is `node.hasMore` alone.
 * Keeping the two apart is what lets the UI say "12 more owners not shown"
 * honestly instead of guessing.
 */
export interface Truncation {
  nodeId: OwnershipNodeId;
  direction: Direction;
  reason: "fanout" | "node_budget";
  /** How many relations were dropped. `null` when unknown (budget exhausted). */
  omitted: number | null;
}

export interface OwnershipGraph {
  rootId: OwnershipNodeId;
  nodes: OwnershipNode[];
  edges: OwnershipEdge[];
  truncated: Truncation[];
  /** Companies whose lookup failed. The graph is still returned — one dead
   *  branch must not fail the whole request. */
  errors: { nodeId: OwnershipNodeId; message: string }[];
}


// ─── Limits ─────────────────────────────────────────────────────────────────

export const OWNERSHIP_LIMITS = {
  /** Total nodes across the whole graph. */
  maxNodes: 120,
  /** Relations expanded from any single node in one direction. */
  maxFanout: 25,
  /** Hard ceiling on the depth a caller may request, either direction. */
  maxDepth: 3,
  /** Concurrent CVR lookups. The upstream limit is 60/min. */
  concurrency: 5,
} as const;

export interface TraverseOptions {
  /** Hops toward owners. 0 disables upward traversal. */
  up: number;
  /** Hops toward owned companies. 0 disables downward traversal. */
  down: number;
  /** Include management edges (leaf-only regardless). */
  includeManagement: boolean;
  maxNodes?: number;
  maxFanout?: number;
}

export const DEFAULT_TRAVERSE_OPTIONS: TraverseOptions = {
  up: 2,
  down: 1,
  includeManagement: true,
};
