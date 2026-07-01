"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SearchFiltersState } from "@/lib/stores/search-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { X, ArrowUpRight, RotateCcw, ChevronRight } from "lucide-react";

interface ParseResult {
  filters: Partial<SearchFiltersState>;
  reasoning: string;
}

const FILTER_LABELS: Record<string, string> = {
  query:                 "Keyword",
  industryCode:          "Industry",
  industrySecondaryCode: "Sub-industry",
  companyformCode:       "Company type",
  companystatusCode:     "Status",
  foundedPeriod:         "Founded",
  region:                "Region",
  city:                  "City",
  zipcode:               "ZIP",
  municipality:          "Municipality",
  street:                "Street",
  contactPhone:          "Phone",
  contactEmail:          "Email",
  contactWww:            "Website",
  skipMarketingOptOut:   "Contactable",
};

const FILTER_HUE: Record<string, string> = {
  query:                 "#8b5cf6",
  industryCode:          "#3b82f6",
  industrySecondaryCode: "#60a5fa",
  companyformCode:       "#f59e0b",
  companystatusCode:     "#10b981",
  foundedPeriod:         "#f97316",
  region:                "#14b8a6",
  city:                  "#14b8a6",
  zipcode:               "#14b8a6",
  municipality:          "#2dd4bf",
  street:                "#2dd4bf",
  contactPhone:          "#94a3b8",
  contactEmail:          "#94a3b8",
  contactWww:            "#94a3b8",
  skipMarketingOptOut:   "#10b981",
};

const FOUNDED: Record<string, string> = {
  last30: "Last 30 days", last90: "Last 3 months",
  last365: "Last year",   last3y: "Last 3 years", all: "Any time",
};
const FORMS: Record<string, string> = {
  "10": "ENK", "15": "PMV", "30": "I/S",
  "60": "A/S", "80": "ApS", "110": "Forening",
  "115": "Frivillig forening", "210": "Foreign branch",
};
const REGIONS: Record<string, string> = {
  hovedstaden: "Capital Region",
  sjaelland:   "Zealand",
  syddanmark:  "Southern Denmark",
  midtjylland: "Central Jutland",
  nordjylland: "Northern Jutland",
};

function display(key: string, value: unknown): string {
  const v = String(value);
  if (key === "foundedPeriod")       return FOUNDED[v] ?? v;
  if (key === "companyformCode")     return FORMS[v] ?? v;
  if (key === "region")              return REGIONS[v] ?? v;
  if (key === "skipMarketingOptOut") return "Yes";
  return v;
}

const EXAMPLES = [
  "IT firms in Copenhagen, founded last 3 years",
  "ApS restaurants in Aarhus",
  "Electricians in Southern Denmark",
  "New A/S companies in Aalborg",
];

type Phase = "idle" | "loading" | "done" | "error";

export function AIHelperDialog({
  open,
  onOpenChange,
  onApplyFilters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: Partial<SearchFiltersState>) => void;
}) {
  const { t } = useLanguage();
  const s = t.search.aiHelper || {
    button: "AI Helper",
    title: "Search with plain English",
    placeholder: "Describe the companies you're looking for…",
    help: "AI will parse and fill the filters for you.",
    parsing: "Analysing…",
    preview: "Filter preview",
    confirm: "Apply filters",
    cancel: "Cancel",
    error: "Could not parse request. Try being more specific.",
  };

  const [query, setQuery]   = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [phase, setPhase]   = useState<Phase>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const parseQuery = async () => {
    if (!query.trim() || phase === "loading") return;
    setError(null);
    setParsed(null);
    setPhase("loading");
    try {
      const res = await fetch("/api/ai/parse-search-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to parse");
      }
      setParsed(await res.json());
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : s.error);
      setPhase("error");
    }
  };

  const handleApply = () => {
    if (!parsed) return;
    onApplyFilters(parsed.filters);
    onOpenChange(false);
    setQuery("");
    setParsed(null);
    setPhase("idle");
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuery("");
    setParsed(null);
    setError(null);
    setPhase("idle");
  };

  const handleReset = () => {
    setParsed(null);
    setError(null);
    setPhase("idle");
    setTimeout(() => textareaRef.current?.focus(), 80);
  };

  const activeFilters = parsed
    ? Object.entries(parsed.filters).filter(
        ([, v]) => v !== undefined && v !== "" && v !== "all" && v !== false
      )
    : [];

  const statusDot = {
    idle:    { bg: "bg-zinc-300",   label: "Ready" },
    loading: { bg: "bg-amber-400 animate-pulse", label: "Analysing" },
    done:    { bg: "bg-emerald-400", label: `${activeFilters.length} filter${activeFilters.length !== 1 ? "s" : ""}` },
    error:   { bg: "bg-red-400",    label: "Error" },
  }[phase];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 w-full max-w-[calc(100vw-1.5rem)] sm:max-w-[520px] rounded-2xl overflow-hidden border-0 shadow-2xl"
        style={{ background: "linear-gradient(180deg, #18181b 0%, #09090b 100%)" }}
      >
        {/* ── Status bar ── */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className={cn("size-1.5 rounded-full shrink-0", statusDot.bg)} />
            <span className="text-[11px] font-mono font-medium text-zinc-400 tracking-wide uppercase">
              {statusDot.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-[10px] font-mono text-zinc-600">⏎ to analyse</span>
            <button
              onClick={handleClose}
              className="size-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* ── Query input ── */}
        <div className="px-4 pt-4 pb-3">
          <Textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (phase === "error") setPhase("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); parseQuery(); }
            }}
            placeholder={s.placeholder}
            rows={3}
            disabled={phase === "loading"}
            className={cn(
              "w-full resize-none border-0 shadow-none p-0 bg-transparent",
              "text-[15px] leading-relaxed font-normal text-zinc-100",
              "placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:outline-none",
            )}
          />
        </div>

        {/* ── Progress bar (loading) ── */}
        <div className="h-px mx-4 bg-white/8 relative overflow-hidden">
          {phase === "loading" && (
            <span
              className="absolute inset-y-0 left-0 bg-indigo-500"
              style={{ animation: "ai-progress 1.8s ease-in-out infinite", width: "40%" }}
            />
          )}
        </div>

        {/* ── Examples (idle, no query) ── */}
        {phase === "idle" && !query && (
          <div className="px-4 pt-2.5 pb-1 flex flex-wrap gap-x-1 gap-y-0.5">
            <span className="text-[11px] text-zinc-600 mr-1">Try:</span>
            {EXAMPLES.map((ex, i) => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); setTimeout(() => textareaRef.current?.focus(), 40); }}
                className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                {ex}{i < EXAMPLES.length - 1 && <span className="text-zinc-700 ml-1">·</span>}
              </button>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {phase === "error" && error && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-800/40">
            <p className="text-[12px] text-red-400">{error}</p>
          </div>
        )}

        {/* ── Results ── */}
        {phase === "done" && parsed && (
          <div className="mx-4 mt-3 rounded-xl overflow-hidden border border-white/8">
            {/* Filter rows */}
            {activeFilters.length > 0 ? (
              <div className="divide-y divide-white/5">
                {activeFilters.map(([key, value]) => (
                  <div key={key} className="flex items-center px-3 py-2.5 gap-4 hover:bg-white/4 transition-colors">
                    <div
                      className="size-1.5 rounded-full shrink-0"
                      style={{ background: FILTER_HUE[key] ?? "#6366f1" }}
                    />
                    <span className="text-[11px] text-zinc-500 w-28 shrink-0 capitalize">
                      {FILTER_LABELS[key] ?? key}
                    </span>
                    <span className="text-[13px] font-mono text-zinc-100 font-medium truncate">
                      {display(key, value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-3 text-[12px] text-zinc-500">
                No specific filters — will search broadly.
              </div>
            )}

            {/* Reasoning */}
            {parsed.reasoning && (
              <div className="px-3 py-2.5 border-t border-white/8 bg-white/3">
                <p className="text-[11px] text-zinc-500 leading-relaxed">{parsed.reasoning}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 mt-3 border-t border-white/8">
          {phase === "done" ? (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RotateCcw className="size-3" />
              Try again
            </button>
          ) : (
            <span className="text-[11px] text-zinc-700 font-mono">CVR-MATE AI</span>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-7 px-2.5 text-[12px] text-zinc-500 hover:text-zinc-200 hover:bg-white/8"
            >
              {s.cancel}
            </Button>

            {phase !== "done" ? (
              <button
                onClick={parseQuery}
                disabled={!query.trim() || phase === "loading"}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium transition-all",
                  "bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed",
                  "shadow-[0_0_0_1px_rgba(99,102,241,0.4)]"
                )}
              >
                Analyse
                <ChevronRight className="size-3.5" />
              </button>
            ) : (
              <button
                onClick={handleApply}
                disabled={activeFilters.length === 0}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium transition-all",
                  "bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed",
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
                )}
              >
                {s.confirm}
                <ArrowUpRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Keyframe for progress animation */}
        <style>{`
          @keyframes ai-progress {
            0%   { transform: translateX(-100%); }
            50%  { transform: translateX(200%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
