"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SearchFiltersState } from "@/lib/stores/search-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ArrowRight,
  RotateCcw,
  X,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Building2,
  Calendar,
  Tag,
  Hash,
  Phone,
  Globe,
} from "lucide-react";

interface ParseResult {
  filters: Partial<SearchFiltersState>;
  reasoning: string;
}

// Human-readable labels + icons for each filter key
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FILTER_META: Record<string, { label: string; icon: React.FC<any>; color: string }> = {
  query:                 { label: "Name",           icon: Tag,       color: "bg-violet-50 text-violet-700 border-violet-200" },
  industryCode:          { label: "Industry",        icon: Building2, color: "bg-blue-50 text-blue-700 border-blue-200" },
  industrySecondaryCode: { label: "Sub-industry",    icon: Building2, color: "bg-blue-50 text-blue-700 border-blue-200" },
  companyformCode:       { label: "Company type",    icon: Hash,      color: "bg-amber-50 text-amber-700 border-amber-200" },
  companystatusCode:     { label: "Status",          icon: CheckCircle2, color: "bg-green-50 text-green-700 border-green-200" },
  foundedPeriod:         { label: "Founded",         icon: Calendar,  color: "bg-orange-50 text-orange-700 border-orange-200" },
  region:                { label: "Region",          icon: MapPin,    color: "bg-teal-50 text-teal-700 border-teal-200" },
  city:                  { label: "City",            icon: MapPin,    color: "bg-teal-50 text-teal-700 border-teal-200" },
  zipcode:               { label: "ZIP",             icon: MapPin,    color: "bg-teal-50 text-teal-700 border-teal-200" },
  municipality:          { label: "Municipality",    icon: MapPin,    color: "bg-teal-50 text-teal-700 border-teal-200" },
  street:                { label: "Street",          icon: MapPin,    color: "bg-teal-50 text-teal-700 border-teal-200" },
  contactPhone:          { label: "Phone",           icon: Phone,     color: "bg-slate-50 text-slate-700 border-slate-200" },
  contactEmail:          { label: "Email",           icon: Globe,     color: "bg-slate-50 text-slate-700 border-slate-200" },
  contactWww:            { label: "Website",         icon: Globe,     color: "bg-slate-50 text-slate-700 border-slate-200" },
  skipMarketingOptOut:   { label: "Contactable only",icon: CheckCircle2, color: "bg-green-50 text-green-700 border-green-200" },
};

const FOUNDED_LABELS: Record<string, string> = {
  last30: "Last 30 days", last90: "Last 3 months",
  last365: "Last year",   last3y: "Last 3 years", all: "Any time",
};

const EXAMPLE_QUERIES = [
  "IT companies in Copenhagen founded last year",
  "ApS restaurants in Aarhus",
  "Construction firms in Southern Denmark",
  "Consulting companies with 10+ employees",
];

function formatFilterValue(key: string, value: unknown): string {
  if (key === "foundedPeriod") return FOUNDED_LABELS[String(value)] ?? String(value);
  if (key === "skipMarketingOptOut") return value ? "Yes" : "No";
  if (key === "companyformCode") {
    const map: Record<string, string> = { "10": "ENK", "15": "PMV", "30": "I/S", "60": "A/S", "80": "ApS", "110": "Forening", "115": "Frivillig forening", "210": "Foreign" };
    return map[String(value)] ?? String(value);
  }
  return String(value);
}

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

  const [query, setQuery] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && !parsed) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
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
        throw new Error(data.error || "Failed to parse request");
      }
      const result = (await res.json()) as ParseResult;
      setParsed(result);
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
      <DialogContent className="p-0 gap-0 w-full max-w-[calc(100vw-2rem)] sm:max-w-xl overflow-hidden rounded-2xl border border-border/60 shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="size-4 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground leading-tight">{s.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{s.help}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5 shrink-0"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Input area — always visible */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={s.placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  parseQuery();
                }
              }}
              rows={3}
              disabled={loading}
              className="resize-none text-sm leading-relaxed pr-3 rounded-xl border-border/60 bg-muted/30 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-indigo-400 transition-colors placeholder:text-muted-foreground/60"
            />
            <p className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground/40 select-none pointer-events-none">
              ↵ enter
            </p>
          </div>

          {/* Example chips — only before parsing */}
          {!parsed && !loading && !error && (
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUERIES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setQuery(ex); setTimeout(() => textareaRef.current?.focus(), 40); }}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-indigo-300 hover:bg-indigo-50 transition-all leading-none"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex gap-2.5 items-start rounded-xl bg-red-50 border border-red-200 px-3.5 py-3">
              <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 font-medium">Parsing failed</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-indigo-400 animate-pulse" />
                <span>{s.parsing}</span>
              </div>
              <div className="space-y-2">
                {[80, 60, 40].map((w) => (
                  <div key={w} className="h-2 rounded-full bg-muted animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {parsed && !loading && (
            <div className="space-y-3">
              {/* Filter chips */}
              <div className="rounded-xl border border-border/40 bg-muted/10 p-3.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                  {s.preview} · {activeFilters.length} filter{activeFilters.length !== 1 ? "s" : ""}
                </p>
                {activeFilters.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {activeFilters.map(([key, value]) => {
                      const meta = FILTER_META[key];
                      const Icon = meta?.icon ?? Tag;
                      return (
                        <span
                          key={key}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-lg border",
                            meta?.color ?? "bg-muted text-foreground border-border"
                          )}
                        >
                          <Icon className="size-3 shrink-0" strokeWidth={2} />
                          <span className="text-[10px] font-normal opacity-70">{meta?.label ?? key}</span>
                          <span>{formatFilterValue(key, value)}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No specific filters detected — will search broadly.</p>
                )}
              </div>

              {/* Reasoning */}
              <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl bg-muted/30 border border-border/30">
                <Sparkles className="size-3.5 text-indigo-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground leading-relaxed">{parsed.reasoning}</p>
              </div>

              {/* Try again */}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="size-3" />
                Try a different query
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border/40 bg-muted/20">
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            {s.cancel}
          </Button>

          {!parsed ? (
            <Button
              size="sm"
              onClick={parseQuery}
              disabled={!query.trim() || loading}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Sparkles className="size-3.5" />
              {loading ? s.parsing : "Analyse"}
              {!loading && <ArrowRight className="size-3.5" />}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleApply}
              disabled={activeFilters.length === 0}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <CheckCircle2 className="size-3.5" />
              {s.confirm}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
