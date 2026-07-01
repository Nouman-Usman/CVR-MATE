"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SearchFiltersState } from "@/lib/stores/search-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { X, ArrowRight, RotateCcw, Info, AlertCircle, Sparkles } from "lucide-react";

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

const FILTER_DOT: Record<string, string> = {
  query:                 "bg-violet-500",
  industryCode:          "bg-blue-500",
  industrySecondaryCode: "bg-blue-400",
  companyformCode:       "bg-amber-500",
  companystatusCode:     "bg-emerald-500",
  foundedPeriod:         "bg-orange-500",
  region:                "bg-teal-500",
  city:                  "bg-teal-500",
  zipcode:               "bg-teal-500",
  municipality:          "bg-teal-400",
  street:                "bg-teal-400",
  contactPhone:          "bg-slate-400",
  contactEmail:          "bg-slate-400",
  contactWww:            "bg-slate-400",
  skipMarketingOptOut:   "bg-emerald-500",
};

const FOUNDED: Record<string, string> = {
  last30: "Last 30 days", last90: "Last 3 months",
  last365: "Last year",   last3y: "Last 3 years", all: "Any time",
};
const FORMS: Record<string, string> = {
  "10": "ENK – Enkeltmandsvirksomhed",
  "15": "PMV",
  "30": "I/S – Interessentskab",
  "60": "A/S – Aktieselskab",
  "80": "ApS – Anpartsselskab",
  "110": "Forening",
  "115": "Frivillig forening",
  "210": "Foreign branch",
};
const REGIONS: Record<string, string> = {
  hovedstaden: "Capital Region (Hovedstaden)",
  sjaelland:   "Zealand (Sjælland)",
  syddanmark:  "Southern Denmark (Syddanmark)",
  midtjylland: "Central Jutland (Midtjylland)",
  nordjylland: "Northern Jutland (Nordjylland)",
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
  "IT consultancies in Copenhagen founded last 3 years",
  "ApS restaurants in Aarhus",
  "Electricians in Southern Denmark",
  "Newly registered A/S companies in Aalborg",
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
    placeholder: "E.g., tech companies in Copenhagen founded in the last 3 years",
    help: "Describe what you're looking for. AI will fill the filters for you.",
    parsing: "Analysing your request…",
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 w-full max-w-[calc(100vw-2rem)] sm:max-w-[600px] rounded-xl overflow-hidden shadow-2xl border border-border/60"
      >
        {/* ── Header ── */}
        <header className="px-6 h-16 border-b border-border flex items-center justify-between bg-background">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-semibold tracking-tight border border-indigo-200/50">
              <Sparkles className="size-3" />
              AI
            </span>
            <div className="w-px h-4 bg-border" />
            <h1 className="text-[15px] font-semibold text-foreground">{s.title}</h1>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* ── Body ── */}
        <div className="p-6 flex flex-col gap-5">

          {/* Textarea container */}
          {phase !== "done" && (
            <div className={cn(
              "border rounded-lg p-4 bg-background transition-all duration-200",
              phase === "error" ? "border-destructive/50" : "border-border/60 focus-within:border-indigo-300 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
            )}>
              <textarea
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
                rows={4}
              disabled={phase === "loading"}
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 disabled:opacity-60"
              />
            </div>
          )}

          {/* Error */}
          {phase === "error" && error && (
            <div className="flex gap-2.5 items-start p-3.5 rounded-lg bg-destructive/8 border border-destructive/20">
              <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
              <p className="text-[13px] text-destructive leading-relaxed">{error}</p>
            </div>
          )}

          {/* Loading */}
          {phase === "loading" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 py-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 rounded-full bg-indigo-500 animate-bounce"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
                <span className="text-[13px] text-muted-foreground">{s.parsing}</span>
              </div>
              {/* Skeleton rows */}
              <div className="space-y-2.5">
                {[80, 60, 72].map((w, i) => (
                  <div key={i} className="flex items-center gap-3 h-8">
                    <div className="size-2 rounded-full bg-muted animate-pulse" />
                    <div className="h-3 rounded bg-muted animate-pulse" style={{ width: `${w}px` }} />
                    <div className="h-3 rounded bg-muted animate-pulse ml-auto" style={{ width: `${w + 40}px` }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {phase === "done" && parsed && (
            <div className="flex flex-col gap-4">
              {activeFilters.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                  {activeFilters.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center gap-4 px-4 py-3 bg-background hover:bg-muted/30 transition-colors"
                    >
                      <span className={cn("size-2 rounded-full shrink-0", FILTER_DOT[key] ?? "bg-blue-500")} />
                      <span className="text-[12px] text-muted-foreground w-28 shrink-0">
                        {FILTER_LABELS[key] ?? key}
                      </span>
                      <span className="text-[13px] font-mono font-medium text-foreground truncate">
                        {display(key, value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-[13px] text-muted-foreground border border-border rounded-lg bg-muted/20">
                  No specific filters detected — will search broadly.
                </div>
              )}

              {/* Reasoning */}
              {parsed.reasoning && (
                <div className="flex items-start gap-2.5">
                  <Info className="size-3.5 shrink-0 text-muted-foreground/60 mt-0.5" />
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{parsed.reasoning}</p>
                </div>
              )}

              {/* Reset */}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                <RotateCcw className="size-3" />
                Try a different query
              </button>
            </div>
          )}

          {/* Example chips — only in idle/error with no results */}
          {(phase === "idle" || phase === "error") && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => { setQuery(ex); setPhase("idle"); setError(null); setTimeout(() => textareaRef.current?.focus(), 40); }}
                    className="px-3 py-1.5 bg-muted/60 border border-border/40 rounded-full text-[12px] text-muted-foreground hover:border-foreground hover:bg-secondary/20 hover:text-foreground transition-all"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Info className="size-3.5 text-muted-foreground/50 shrink-0" />
                <p className="text-[12px] text-muted-foreground/70">{s.help}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            {s.cancel}
          </button>

          {phase !== "done" ? (
            <button
              onClick={parseQuery}
              disabled={!query.trim() || phase === "loading"}
              className={cn(
                "flex items-center gap-2.5 px-6 h-11 rounded-full text-[15px] font-semibold text-white transition-all",
                "bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-700 hover:to-violet-600 active:scale-[0.97]",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
                "shadow-sm"
              )}
            >
              Analyse
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              onClick={handleApply}
              disabled={activeFilters.length === 0}
              className={cn(
                "flex items-center gap-2.5 px-6 h-11 rounded-full text-[15px] font-semibold text-white transition-all",
                "bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-700 hover:to-violet-600 active:scale-[0.97]",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
                "shadow-sm"
              )}
            >
              {s.confirm}
              <ArrowRight className="size-4" />
            </button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
