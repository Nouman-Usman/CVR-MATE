"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SearchFiltersState } from "@/lib/stores/search-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowRight, RotateCcw, X, AlertCircle } from "lucide-react";

interface ParseResult {
  filters: Partial<SearchFiltersState>;
  reasoning: string;
}

const FILTER_LABELS: Record<string, string> = {
  query:                 "Name / keyword",
  industryCode:          "Industry",
  industrySecondaryCode: "Sub-industry code",
  companyformCode:       "Company type",
  companystatusCode:     "Status",
  foundedPeriod:         "Founded",
  region:                "Region",
  city:                  "City",
  zipcode:               "ZIP code",
  municipality:          "Municipality",
  street:                "Street",
  contactPhone:          "Phone",
  contactEmail:          "Email",
  contactWww:            "Website",
  skipMarketingOptOut:   "Contactable only",
};

// Category → left-bar accent color
const FILTER_ACCENT: Record<string, string> = {
  query:                 "border-l-violet-400",
  industryCode:          "border-l-blue-400",
  industrySecondaryCode: "border-l-blue-300",
  companyformCode:       "border-l-amber-400",
  companystatusCode:     "border-l-emerald-400",
  foundedPeriod:         "border-l-orange-400",
  region:                "border-l-teal-400",
  city:                  "border-l-teal-400",
  zipcode:               "border-l-teal-400",
  municipality:          "border-l-teal-300",
  street:                "border-l-teal-300",
  contactPhone:          "border-l-slate-400",
  contactEmail:          "border-l-slate-400",
  contactWww:            "border-l-slate-400",
  skipMarketingOptOut:   "border-l-emerald-400",
};

const FOUNDED_LABELS: Record<string, string> = {
  last30: "Last 30 days", last90: "Last 3 months",
  last365: "Last year",   last3y: "Last 3 years", all: "Any time",
};

const FORM_LABELS: Record<string, string> = {
  "10": "ENK – Enkeltmandsvirksomhed",
  "15": "PMV – Personal Minor Enterprise",
  "30": "I/S – Interessentskab",
  "60": "A/S – Aktieselskab",
  "80": "ApS – Anpartsselskab",
  "110": "Forening",
  "115": "Frivillig forening",
  "210": "Foreign company branch",
};

const REGION_LABELS: Record<string, string> = {
  hovedstaden: "Capital Region (Hovedstaden)",
  sjaelland:   "Zealand (Sjælland)",
  syddanmark:  "Southern Denmark (Syddanmark)",
  midtjylland: "Central Jutland (Midtjylland)",
  nordjylland: "Northern Jutland (Nordjylland)",
};

function humanValue(key: string, value: unknown): string {
  const v = String(value);
  if (key === "foundedPeriod")    return FOUNDED_LABELS[v] ?? v;
  if (key === "companyformCode")  return FORM_LABELS[v] ?? v;
  if (key === "region")           return REGION_LABELS[v] ?? v;
  if (key === "skipMarketingOptOut") return "Yes";
  return v;
}

const EXAMPLES = [
  "IT consultancies in Copenhagen founded last 3 years",
  "ApS restaurants in Aarhus",
  "Electricians in Southern Denmark",
  "Newly registered A/S companies in Aalborg",
];

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
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && !parsed) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [open, parsed]);

  const parseQuery = async () => {
    if (!query.trim() || loading) return;
    setError(null);
    setParsed(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/parse-search-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to parse");
      }
      setParsed((await res.json()) as ParseResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!parsed) return;
    onApplyFilters(parsed.filters);
    onOpenChange(false);
    setQuery("");
    setParsed(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuery("");
    setParsed(null);
    setError(null);
  };

  const handleReset = () => {
    setParsed(null);
    setError(null);
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
        className="p-0 gap-0 w-full max-w-[calc(100vw-2rem)] sm:max-w-[540px] rounded-xl overflow-hidden shadow-xl ring-1 ring-border/50"
      >
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase select-none">
              AI
            </span>
            <span className="w-px h-3 bg-border/60" />
            <span className="text-[13px] font-medium text-foreground">{s.title}</span>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* ── Input ── */}
        <div className="px-4 pt-3 pb-2">
          <Textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); parseQuery(); }
            }}
            placeholder={s.placeholder}
            rows={2}
            disabled={loading}
            className={cn(
              "resize-none text-[13px] leading-relaxed border-0 shadow-none bg-transparent p-0",
              "focus-visible:ring-0 placeholder:text-muted-foreground/40",
            )}
          />
        </div>

        {/* ── Examples ── */}
        {!parsed && !loading && !error && (
          <div className="px-4 pb-3 flex flex-wrap gap-x-3 gap-y-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); setTimeout(() => textareaRef.current?.focus(), 40); }}
                className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors underline-offset-2 hover:underline"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* ── Divider ── */}
        <div className="h-px bg-border/40 mx-4" />

        {/* ── States ── */}
        <div className="px-4 py-3 min-h-[80px]">

          {/* Error */}
          {error && (
            <div className="flex gap-2 items-start text-[12px] text-red-600">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="inline-flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1 rounded-full bg-muted-foreground/40 animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </span>
              <span>{s.parsing}</span>
            </div>
          )}

          {/* Empty query hint */}
          {!parsed && !loading && !error && !query && (
            <p className="text-[12px] text-muted-foreground/50">{s.help}</p>
          )}

          {/* Results */}
          {parsed && !loading && (
            <div className="space-y-3">
              {activeFilters.length > 0 ? (
                <div className="space-y-0.5">
                  {activeFilters.map(([key, value]) => (
                    <div
                      key={key}
                      className={cn(
                        "flex items-baseline gap-3 py-1.5 pl-3 border-l-2",
                        FILTER_ACCENT[key] ?? "border-l-border"
                      )}
                    >
                      <span className="text-[11px] text-muted-foreground w-32 shrink-0">
                        {FILTER_LABELS[key] ?? key}
                      </span>
                      <span className="font-mono text-[12px] text-foreground font-medium">
                        {humanValue(key, value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  No specific filters detected — will search broadly.
                </p>
              )}

              {/* Reasoning */}
              {parsed.reasoning && (
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed border-t border-border/30 pt-2.5">
                  {parsed.reasoning}
                </p>
              )}

              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <RotateCcw className="size-3" />
                Try a different query
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/40 bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-7 px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
          >
            {s.cancel}
          </Button>

          {!parsed ? (
            <Button
              size="sm"
              onClick={parseQuery}
              disabled={!query.trim() || loading}
              className="h-7 px-3 text-[12px] gap-1.5"
            >
              Analyse
              <ArrowRight className="size-3" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleApply}
              disabled={activeFilters.length === 0}
              className="h-7 px-3 text-[12px]"
            >
              {s.confirm}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
