"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { InlineLoader } from "@/components/loading-screen";
import { useOwnership } from "@/lib/hooks/use-ownership";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  DEFAULT_GRAPH_FILTER,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROOT_NODE_HEIGHT,
  edgeLabel,
  layoutGraph,
  type GraphFilter,
} from "@/lib/ownership/layout";
import type { OwnershipNode } from "@/lib/ownership/types";

/**
 * The ejerdiagram: owners and officers above, the subject in the middle, what
 * it owns below.
 *
 * Depth is a server concern (it decides which CVR lookups happen) and lives in
 * the query key; every other toggle filters an already-fetched graph on the
 * client, so flipping "show management" is instant and costs nothing.
 */
export default function OwnershipTab({ vat }: { vat: string }) {
  const { t } = useLanguage();
  const o = t.companyDetail.ownership;
  const router = useRouter();

  const [up, setUp] = useState(2);
  const [down, setDown] = useState(1);
  const [filter, setFilter] = useState<GraphFilter>(DEFAULT_GRAPH_FILTER);
  const [showOwnership, setShowOwnership] = useState(true);
  const [showVoting, setShowVoting] = useState(true);

  const { data, isLoading, error } = useOwnership({
    vat,
    up,
    down,
    // Only skip the fetch when management is off AND nothing else needs it —
    // hiding client-side keeps the toggle instant, so we still ask for it.
    includeManagement: true,
  });

  const graph = data?.graph;

  const laid = useMemo(
    () => (graph ? layoutGraph(graph, filter) : null),
    [graph, filter]
  );

  const flow = useMemo(() => {
    if (!laid || !graph) return null;

    const nodes: Node[] = laid.nodes.map((n) => ({
      id: n.id,
      type: "ownership",
      position: n.position,
      // Dimensions are deliberately not passed: dagre needs them to lay out,
      // React Flow measures the rendered DOM itself. The node card sets its own
      // size from the same constants, so the two agree.
      data: { node: n, isRoot: n.id === graph.rootId, unexpandedLabel: o.unexpanded },
      draggable: true,
    }));

    const edges: Edge[] = laid.edges.map((e) => {
      const isOwnership = e.kind === "ownership";
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        label: edgeLabel(e, { showOwnership, showVoting }) ?? undefined,
        // Line style, not colour, carries the distinction: with two edge kinds
        // on one canvas colour alone does not survive a printout.
        animated: false,
        style: {
          strokeWidth: isOwnership ? 2 : 1.25,
          stroke: isOwnership ? "#2563eb" : "#94a3b8",
          strokeDasharray: isOwnership ? undefined : "5 4",
        },
        labelStyle: {
          fontSize: 11,
          fontWeight: isOwnership ? 700 : 500,
          fill: isOwnership ? "#1d4ed8" : "#64748b",
        },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.92 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      };
    });

    return { nodes, edges };
  }, [laid, graph, showOwnership, showVoting, o.unexpanded]);

  // Identifies a layout, so the canvas knows when to re-fit. NOT a React key:
  // remounting React Flow is what broke edge rendering — the uncontrolled store
  // initialises once per instance, and every remount after the first rendered
  // nodes with no edges and never applied fitView.
  const layoutKey = `${vat}:${up}:${down}:${filter.showManagement}:${filter.showPersons}:${filter.hiddenRoleTypes.join(",")}`;

  if (error) {
    const upgrade = (error as Error & { upgrade?: boolean }).upgrade;
    return upgrade ? (
      <UpgradePanel title={o.upgradeTitle} body={o.upgradeBody} cta={o.upgradeCta} />
    ) : (
      <Notice icon="error" title={o.loadError} body={error.message} />
    );
  }

  if (isLoading || !flow || !graph) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-12">
        <InlineLoader />
      </div>
    );
  }

  const hasRelations = graph.edges.length > 0;
  const truncatedCount = graph.truncated.reduce((sum, tr) => sum + (tr.omitted ?? 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{o.title}</h2>
            <p className="text-[11px] text-slate-400">{o.subtitle}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <Legend color="#2563eb" solid label={o.legendOwnership} />
            <Legend color="#94a3b8" solid={false} label={o.legendManagement} />
          </div>
        </div>

        {hasRelations ? (
          // The canvas owns its own scroll — the page must never scroll
          // sideways because a graph is wide.
          <div className="h-140 w-full">
            <ReactFlowProvider>
              <OwnershipCanvas
                nodes={flow.nodes}
                edges={flow.edges}
                layoutKey={layoutKey}
                onOpen={(node) => {
                  if (node.vat) router.push(`/company/${node.vat}`);
                  else if (node.participantNumber) router.push(`/person/${node.participantNumber}`);
                }}
              />
            </ReactFlowProvider>
          </div>
        ) : (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300">hub</span>
            <p className="mt-2 text-sm font-semibold text-slate-600">{o.empty}</p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">{o.emptyHint}</p>
          </div>
        )}

        {(truncatedCount > 0 || (laid && laid.hiddenCount > 0)) && (
          <div className="border-t border-slate-100 px-5 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
            {truncatedCount > 0 && (
              <span>{o.truncated.replace("{count}", String(truncatedCount))}</span>
            )}
            {laid && laid.hiddenCount > 0 && (
              <span>{o.hiddenNodes.replace("{count}", String(laid.hiddenCount))}</span>
            )}
          </div>
        )}
      </div>

      <aside className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-5 h-fit space-y-5">
        <Section title={o.depth}>
          <Stepper label={o.levelsUp} value={up} onChange={setUp} />
          <Stepper label={o.levelsDown} value={down} onChange={setDown} />
        </Section>

        <Section title={o.display}>
          <Toggle
            label={o.showManagement}
            checked={filter.showManagement}
            onChange={(v) => setFilter((f) => ({ ...f, showManagement: v }))}
          />
          <Toggle
            label={o.showPersons}
            checked={filter.showPersons}
            onChange={(v) => setFilter((f) => ({ ...f, showPersons: v }))}
          />
          <Toggle
            label={o.showAccountants}
            checked={!filter.hiddenRoleTypes.includes("accountant")}
            onChange={(v) =>
              setFilter((f) => ({
                ...f,
                hiddenRoleTypes: v
                  ? f.hiddenRoleTypes.filter((r) => r !== "accountant")
                  : [...f.hiddenRoleTypes, "accountant"],
              }))
            }
          />
          <Toggle label={o.showOwnership} checked={showOwnership} onChange={setShowOwnership} />
          <Toggle label={o.showVoting} checked={showVoting} onChange={setShowVoting} />
          <p className="text-[10px] leading-snug text-slate-400 pt-1">{o.votingHint}</p>
        </Section>
      </aside>
    </div>
  );
}

/**
 * The canvas, rendered CONTROLLED and never remounted.
 *
 * Positions come from dagre on every change, so React Flow does not need to own
 * them — which is why dragging is off: in controlled mode without a change
 * handler a dragged node snaps back, and the panel, not the mouse, is the
 * modelling mechanism here.
 *
 * `fitView` only runs on init, so a changed layout is re-fitted explicitly.
 */
function OwnershipCanvas({
  nodes,
  edges,
  layoutKey,
  onOpen,
}: {
  nodes: Node[];
  edges: Edge[];
  layoutKey: string;
  onOpen: (node: OwnershipNode) => void;
}) {
  const { fitView } = useReactFlow();
  // The library's own signal that every node has been measured. Fitting before
  // this computes bounds from nodes that have no size yet, which is how the
  // canvas ended up zoomed into empty space.
  const measured = useNodesInitialized();

  useEffect(() => {
    if (!measured) return;
    void fitView({ padding: 0.15, maxZoom: 1 });
  }, [layoutKey, measured, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      nodesDraggable={false}
      minZoom={0.05}
      maxZoom={1.6}
      onNodeClick={(_, n) => onOpen((n.data as { node: OwnershipNode }).node)}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#e2e8f0" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeStrokeWidth={2} />
    </ReactFlow>
  );
}

// ─── Node ───────────────────────────────────────────────────────────────────

function OwnershipNodeCard({ data }: NodeProps) {
  const { node, isRoot, unexpandedLabel } = data as {
    node: OwnershipNode;
    isRoot: boolean;
    unexpandedLabel: string;
  };
  const isPerson = node.kind === "person";
  const ceased = node.status != null && node.status !== "NORMAL";

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md ${
        isRoot
          ? "border-blue-300 bg-blue-50/70 ring-2 ring-blue-200"
          : "border-slate-200 bg-white"
      }`}
      style={{ width: NODE_WIDTH, height: isRoot ? ROOT_NODE_HEIGHT : NODE_HEIGHT }}
    >
      <Handle type="target" position={Position.Top} className="bg-slate-300!" />
      <div className="flex items-start gap-2">
        <span
          className={`material-symbols-outlined text-base shrink-0 ${
            isPerson ? "text-violet-500" : isRoot ? "text-blue-600" : "text-slate-400"
          }`}
        >
          {isPerson ? "person" : "business"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold leading-tight text-slate-800">
            {node.name}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-slate-400">
            {node.vat ?? node.companyForm ?? ""}
          </p>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {ceased && (
          <Chip className="bg-amber-50 text-amber-700">{node.status}</Chip>
        )}
        {node.adProtected && (
          // Same warning the company page carries — it must survive onto the
          // canvas, or the diagram becomes a way to bypass it.
          <Chip className="bg-rose-50 text-rose-600">reklamebeskyttet</Chip>
        )}
        {node.hasMore && <Chip className="bg-slate-100 text-slate-500">{unexpandedLabel}</Chip>}
      </div>
      <Handle type="source" position={Position.Bottom} className="bg-slate-300!" />
    </div>
  );
}

const NODE_TYPES = { ownership: OwnershipNodeCard };

// ─── Panel primitives ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-[12px] text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-[12px] text-slate-600">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <StepButton disabled={value <= 0} onClick={() => onChange(value - 1)} glyph="remove" />
        <span className="w-5 text-center font-mono tabular-nums text-slate-800">{value}</span>
        {/* 3 is the server's ceiling; offering 4 would silently clamp. */}
        <StepButton disabled={value >= 3} onClick={() => onChange(value + 1)} glyph="add" />
      </div>
    </div>
  );
}

function StepButton({
  disabled,
  onClick,
  glyph,
}: {
  disabled: boolean;
  onClick: () => void;
  glyph: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex size-5 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
    >
      <span className="material-symbols-outlined text-[13px]">{glyph}</span>
    </button>
  );
}

function Legend({ color, solid, label }: { color: string; solid: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="20" height="6" aria-hidden>
        <line
          x1="0"
          y1="3"
          x2="20"
          y2="3"
          stroke={color}
          strokeWidth={solid ? 2 : 1.25}
          strokeDasharray={solid ? undefined : "5 4"}
        />
      </svg>
      {label}
    </span>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

function Notice({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-12 text-center">
      <span className="material-symbols-outlined text-4xl text-slate-300">{icon}</span>
      <p className="mt-2 text-sm font-semibold text-slate-700">{title}</p>
      {body && <p className="mt-1 text-xs text-slate-400">{body}</p>}
    </div>
  );
}

function UpgradePanel({ title, body, cta }: { title: string; body: string; cta: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-50">
        <span className="material-symbols-outlined text-2xl text-blue-600">hub</span>
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">{body}</p>
      <a
        href="/settings"
        className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        {cta}
      </a>
    </div>
  );
}
