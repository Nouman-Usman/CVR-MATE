"use client";

import {
  BarChart3,
  Bookmark,
  Building2,
  CheckCircle2,
  FileText,
  KanbanSquare,
  ListTodo,
  Loader2,
  Mail,
  Search,
  Sparkles,
  StickyNote,
  UserCheck,
  Users,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolTraceEntry } from "@/lib/hooks/use-search-agent";

const TOOL_META: Record<string, { label: string; icon: LucideIcon }> = {
  search_companies: { label: "Search", icon: Search },
  get_company: { label: "Company", icon: Building2 },
  suggest_companies: { label: "Suggest", icon: Search },
  get_participant: { label: "Person", icon: UserCheck },
  get_company_people: { label: "People", icon: Users },
  company_briefing: { label: "Briefing", icon: FileText },
  draft_outreach: { label: "Outreach", icon: Mail },
  enrich_company: { label: "Enrich", icon: Sparkles },
  enrich_person: { label: "Enrich person", icon: Sparkles },
  analyze_pipeline: { label: "Pipeline analysis", icon: BarChart3 },
  suggest_todos: { label: "Todos", icon: ListTodo },
  save_company: { label: "Save company", icon: Bookmark },
  unsave_company: { label: "Unsave company", icon: Bookmark },
  create_todo: { label: "Create task", icon: ListTodo },
  create_saved_search: { label: "Save search", icon: Search },
  create_lead_trigger: { label: "Lead trigger", icon: Sparkles },
  create_company_note: { label: "Add note", icon: StickyNote },
  follow_person: { label: "Follow person", icon: UserCheck },
  push_to_crm: { label: "Push to CRM", icon: KanbanSquare },
};

function humanize(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ToolTrace({ entry }: { entry: ToolTraceEntry }) {
  const meta = TOOL_META[entry.name] ?? { label: humanize(entry.name), icon: Wrench };
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium",
        entry.status === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-border bg-muted/50 text-muted-foreground"
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="text-foreground/80">{meta.label}</span>
      {entry.status === "running" && <Loader2 className="size-3.5 animate-spin text-blue-500" />}
      {entry.status === "done" && <CheckCircle2 className="size-3.5 text-emerald-500" />}
      {entry.status === "error" && <XCircle className="size-3.5 text-red-500" />}
      {entry.summary && entry.status !== "running" && (
        <span className="text-muted-foreground/80">· {entry.summary}</span>
      )}
    </div>
  );
}
