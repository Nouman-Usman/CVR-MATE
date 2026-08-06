import type { LucideIcon } from "lucide-react";
import {
  SearchCheck,
  Zap,
  Bookmark,
  ListTodo,
  FileText,
  Send,
  ShoppingCart,
  KanbanSquare,
  FileSignature,
  AlarmClock,
  MessagesSquare,
  BadgeCheck,
  PackageCheck,
  Coins,
} from "lucide-react";

/**
 * The catalogue of metrics the dashboard can show.
 *
 * The dashboard used to hard-code four cards, all user-scoped, while ten phases
 * of CRM work — quotes, orders, contracts, pipeline, interactions — went
 * unrepresented. Declaring metrics as data means adding one is a single entry
 * here, and the picker, the ordering and the rendering all follow.
 *
 * Client-safe: this is imported by both the page and the picker dialog.
 */

export type MetricFormat = "count" | "currency";

/** Which slice of the API payload a metric reads from. */
export type MetricScope = "personal" | "crm";

export interface MetricDef {
  id: string;
  /** Danish / English label. */
  label: [string, string];
  icon: LucideIcon;
  href: string;
  format: MetricFormat;
  scope: MetricScope;
  /** Tailwind classes for the icon chip. Token-based so dark mode works. */
  accent: string;
  /** Group heading in the picker. */
  group: [string, string];
  /**
   * Optional second field forming a period-over-period delta. Only set where a
   * comparison is genuinely meaningful — a running balance like "saved
   * companies" has no honest previous value, so it gets no trend rather than a
   * fabricated one.
   */
  compareWith?: string;
  /** Lower is better, so a rise should read as a warning rather than success. */
  inverse?: boolean;
}

const PERSONAL: [string, string] = ["Min prospektering", "My prospecting"];
const SALES: [string, string] = ["Salg", "Sales"];
const RELATIONSHIPS: [string, string] = ["Relationer", "Relationships"];

export const METRICS: MetricDef[] = [
  // ── Personal (always available) ───────────────────────────────────────────
  {
    id: "savedSearches",
    label: ["Gemte søgninger", "Saved searches"],
    icon: SearchCheck,
    href: "/saved-searches",
    format: "count",
    scope: "personal",
    accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    group: PERSONAL,
  },
  {
    id: "activeTriggers",
    label: ["Aktive triggers", "Active triggers"],
    icon: Zap,
    href: "/triggers",
    format: "count",
    scope: "personal",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    group: PERSONAL,
  },
  {
    id: "savedCompanies",
    label: ["Gemte virksomheder", "Saved companies"],
    icon: Bookmark,
    href: "/saved",
    format: "count",
    scope: "personal",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    group: PERSONAL,
  },
  {
    id: "activeTasks",
    label: ["Åbne opgaver", "Open tasks"],
    icon: ListTodo,
    href: "/todos",
    format: "count",
    scope: "personal",
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    group: PERSONAL,
  },

  // ── Sales (org-scoped) ────────────────────────────────────────────────────
  {
    id: "pipelineOpenValue",
    label: ["Pipeline-værdi", "Pipeline value"],
    icon: KanbanSquare,
    href: "/pipeline",
    format: "currency",
    scope: "crm",
    accent: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    group: SALES,
  },
  {
    id: "quotesOpen",
    label: ["Åbne tilbud", "Open quotes"],
    icon: FileText,
    href: "/quotes",
    format: "count",
    scope: "crm",
    accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    group: SALES,
  },
  {
    id: "quotesOpenValue",
    label: ["Tilbud i spil", "Quoted value"],
    icon: Coins,
    href: "/quotes",
    format: "currency",
    scope: "crm",
    accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    group: SALES,
  },
  {
    id: "quotesAwaitingReply",
    label: ["Afventer svar", "Awaiting reply"],
    icon: Send,
    href: "/quotes",
    format: "count",
    scope: "crm",
    accent: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    group: SALES,
  },
  {
    id: "quotesAcceptedValue",
    label: ["Accepteret værdi", "Accepted value"],
    icon: BadgeCheck,
    href: "/quotes",
    format: "currency",
    scope: "crm",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    group: SALES,
  },
  {
    id: "ordersOpen",
    label: ["Åbne ordrer", "Open orders"],
    icon: ShoppingCart,
    href: "/orders",
    format: "count",
    scope: "crm",
    accent: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    group: SALES,
  },
  {
    id: "ordersOpenValue",
    label: ["Ordreværdi", "Order value"],
    icon: PackageCheck,
    href: "/orders",
    format: "currency",
    scope: "crm",
    accent: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    group: SALES,
  },

  // ── Relationships (org-scoped) ────────────────────────────────────────────
  {
    id: "contractsActive",
    label: ["Aktive kontrakter", "Active contracts"],
    icon: FileSignature,
    href: "/reports",
    format: "count",
    scope: "crm",
    accent: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    group: RELATIONSHIPS,
  },
  {
    id: "contractsValue",
    label: ["Kontraktværdi", "Contract value"],
    icon: Coins,
    href: "/reports",
    format: "currency",
    scope: "crm",
    accent: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    group: RELATIONSHIPS,
  },
  {
    id: "contractsExpiringSoon",
    label: ["Udløber < 30 dage", "Expiring < 30 days"],
    icon: AlarmClock,
    href: "/reports",
    format: "count",
    scope: "crm",
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    group: RELATIONSHIPS,
    // A rising count here is a problem, not progress.
    inverse: true,
  },
  {
    id: "interactionsThisWeek",
    label: ["Interaktioner (7 dage)", "Interactions (7 days)"],
    icon: MessagesSquare,
    href: "/interactions",
    format: "count",
    scope: "crm",
    accent: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    group: RELATIONSHIPS,
    compareWith: "interactionsPrevWeek",
  },
];

export const METRICS_BY_ID = new Map(METRICS.map((m) => [m.id, m]));

/** Shown to a user who has never opened the picker. */
export const DEFAULT_METRIC_IDS = [
  "savedSearches",
  "activeTriggers",
  "savedCompanies",
  "activeTasks",
];

/** Grid stays balanced at 2 and 4 columns; beyond 8 the cards stop being a summary. */
export const MAX_SELECTED = 8;
export const MIN_SELECTED = 2;

export const METRIC_STORAGE_KEY = "cvr-mate:dashboard-metrics";

/**
 * Read the saved selection, dropping ids that no longer exist.
 *
 * Filtering rather than falling back wholesale means removing one metric from
 * the catalogue does not silently reset a user's entire layout.
 */
export function parseStoredMetrics(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (id): id is string => typeof id === "string" && METRICS_BY_ID.has(id)
    );
    return valid.length >= MIN_SELECTED ? valid.slice(0, MAX_SELECTED) : null;
  } catch {
    return null;
  }
}

/** Percentage change, or null when a comparison would be meaningless. */
export function trendOf(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null;
  // Growth from zero is undefined, not "infinite percent" — show the raw
  // number instead of a misleading +∞.
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
