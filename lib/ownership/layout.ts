import dagre from "dagre";

import type { OwnershipEdge, OwnershipGraph, OwnershipNode, OwnershipNodeId } from "./types";

/**
 * Filtering and layout for the ownership graph.
 *
 * Pure: no React, no DOM, no clock. The panel toggles run through `filterGraph`
 * and the result through `layoutGraph`, so what the canvas draws is a function
 * of (graph, filter) and nothing else — which is also what makes the orphan
 * rule below testable.
 */

export interface GraphFilter {
  /** Draw board/direction/founder/accountant edges at all. */
  showManagement: boolean;
  /** Draw natural persons. Off leaves the company-only ownership structure. */
  showPersons: boolean;
  /** Role types to hide individually, e.g. ["accountant"]. */
  hiddenRoleTypes: string[];
}

export const DEFAULT_GRAPH_FILTER: GraphFilter = {
  showManagement: true,
  showPersons: true,
  // An auditor is not a lead. LassoX hides persons by role for the same reason.
  hiddenRoleTypes: ["accountant"],
};

export interface FilteredGraph {
  nodes: OwnershipNode[];
  edges: MergedEdge[];
  /** Nodes dropped because every edge touching them was filtered out. */
  hiddenCount: number;
}

/**
 * One drawn line between a pair of nodes. The registry commonly records several
 * roles for the same pair — founder AND owner is the usual case — and drawing
 * them as separate edges puts two labels on the identical path, which renders
 * as overlapping glyphs ("f. 10% r").
 *
 * They are merged into one line instead: the strongest kind wins the styling
 * (ownership is solid, management dashed) and every role contributes to the
 * label, so nothing is lost.
 */
export interface MergedEdge extends OwnershipEdge {
  /** Every role type this line represents, in registry order. */
  roleTypes: string[];
  /** Titles for the management roles folded in, e.g. ["Direktør"]. */
  roleTitles: string[];
}

function mergeParallelEdges(edges: OwnershipEdge[]): MergedEdge[] {
  const byPair = new Map<string, MergedEdge>();

  for (const e of edges) {
    const key = `${e.from}->${e.to}`;
    const existing = byPair.get(key);

    if (!existing) {
      byPair.set(key, {
        ...e,
        id: key,
        roleTypes: [e.roleType],
        roleTitles: e.roleTitle ? [e.roleTitle] : [],
      });
      continue;
    }

    existing.roleTypes.push(e.roleType);
    if (e.roleTitle && !existing.roleTitles.includes(e.roleTitle)) {
      existing.roleTitles.push(e.roleTitle);
    }

    // Ownership dominates: a line carrying a stake is drawn as ownership even
    // when the same party also sits on the board.
    if (e.kind === "ownership") {
      existing.kind = "ownership";
      existing.roleType = e.roleType;
      existing.ownershipPercent = e.ownershipPercent;
      existing.votingPercent = e.votingPercent;
      existing.capitalClasses = e.capitalClasses;
    }
  }

  return [...byPair.values()];
}

/**
 * Apply the panel's toggles.
 *
 * Filtering EDGES can orphan NODES — hide "accountant" and the audit firm has
 * no reason to be on the canvas any more. Leaving it floating would imply a
 * relationship we just said we were not showing, so orphans are dropped. The
 * root is exempt: a company with no visible relations must still render itself,
 * otherwise turning every toggle off yields an empty canvas rather than the
 * company you are looking at.
 */
export function filterGraph(graph: OwnershipGraph, filter: GraphFilter): FilteredGraph {
  const hiddenRoles = new Set(filter.hiddenRoleTypes);
  const personIds = new Set(
    graph.nodes.filter((n) => n.kind === "person").map((n) => n.id)
  );

  const edges = graph.edges.filter((e) => {
    if (e.kind === "management" && !filter.showManagement) return false;
    if (hiddenRoles.has(e.roleType)) return false;
    if (!filter.showPersons && (personIds.has(e.from) || personIds.has(e.to))) return false;
    return true;
  });

  const connected = new Set<OwnershipNodeId>([graph.rootId]);
  for (const e of edges) {
    connected.add(e.from);
    connected.add(e.to);
  }

  const nodes = graph.nodes.filter((n) => connected.has(n.id));

  return {
    nodes,
    edges: mergeParallelEdges(edges),
    hiddenCount: graph.nodes.length - nodes.length,
  };
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export const NODE_WIDTH = 232;
export const NODE_HEIGHT = 84;
/** The subject company is taller — it carries the CVR and a status badge. */
export const ROOT_NODE_HEIGHT = 96;

export interface PositionedNode extends OwnershipNode {
  position: { x: number; y: number };
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: MergedEdge[];
  /** Nodes the filters removed. Surfaced so the canvas can say so rather than
   *  quietly showing a smaller graph than the data contains. */
  hiddenCount: number;
}

/**
 * Layered top-to-bottom layout.
 *
 * Every edge points actor → company, so rank order alone produces the
 * convention people expect: owners and officers above, the subject in the
 * middle, what it owns below. No special-casing per direction.
 */
export function layoutGraph(
  graph: OwnershipGraph,
  filter: GraphFilter = DEFAULT_GRAPH_FILTER
): LayoutResult {
  const { nodes, edges, hiddenCount } = filterGraph(graph, filter);

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    // Generous horizontal separation: edge labels carry percentages and
    // overlapping them is what makes these diagrams unreadable elsewhere.
    nodesep: 48,
    ranksep: 96,
    marginx: 24,
    marginy: 24,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: heightFor(n, graph.rootId) });
  }
  for (const e of edges) {
    // Only edges between surviving nodes — dagre invents a node otherwise.
    if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to);
  }

  dagre.layout(g);

  const positioned = nodes.map((n) => {
    const laid = g.node(n.id);
    const height = heightFor(n, graph.rootId);
    return {
      ...n,
      width: NODE_WIDTH,
      height,
      // dagre centres nodes; React Flow positions by top-left corner.
      position: {
        x: (laid?.x ?? 0) - NODE_WIDTH / 2,
        y: (laid?.y ?? 0) - height / 2,
      },
    };
  });

  return { nodes: positioned, edges, hiddenCount };
}

function heightFor(node: OwnershipNode, rootId: OwnershipNodeId): number {
  return node.id === rootId ? ROOT_NODE_HEIGHT : NODE_HEIGHT;
}

/**
 * Edge label. Ownership shows its numbers; management shows its title —
 * different fields sharing one position, so a toggle that hides percentages
 * must not blank out management edges.
 */
export function edgeLabel(
  edge: MergedEdge,
  opts: { showOwnership: boolean; showVoting: boolean }
): string | null {
  const parts: string[] = [];

  if (edge.kind === "ownership" && opts.showOwnership && edge.ownershipPercent != null) {
    const own = formatPercent(edge.ownershipPercent);
    const voting = edge.votingPercent;
    // Voting only earns space when it disagrees with ownership — which is
    // exactly when it matters (Novo Holdings: 25% of capital, 66.67% of votes).
    parts.push(
      opts.showVoting && voting != null && voting !== edge.ownershipPercent
        ? `${own} / ${formatPercent(voting)}`
        : own
    );
  }

  // Titles ride along on the same line rather than a second overlapping one.
  const title = edge.roleTitles[0] ?? (edge.kind === "management" ? edge.roleType : null);
  if (title) parts.push(title);

  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatPercent(value: number): string {
  // Registry values carry up to 4 decimals (0.6667 -> 66.67). Trailing zeros
  // read as false precision on a canvas.
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}%`;
}
