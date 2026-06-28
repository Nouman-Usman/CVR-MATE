"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SearchFiltersState } from "@/lib/stores/search-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";

interface ParseResult {
  filters: Partial<SearchFiltersState>;
  reasoning: string;
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
    placeholder: "Describe what you're looking for in natural language",
    help: "AI will parse and fill the filters for you.",
    parsing: "Parsing your request...",
    preview: "Filter preview",
    confirm: "Search with these filters",
    cancel: "Cancel",
    error: "Could not parse request. Try being more specific.",
  };
  const [query, setQuery] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parseQuery = async () => {
    if (!query.trim()) return;
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
    if (parsed) {
      onApplyFilters(parsed.filters);
      onOpenChange(false);
      setQuery("");
      setParsed(null);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuery("");
    setParsed(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>{s.help}</DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{s.button}</Label>
              <Input
                placeholder={s.placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) parseQuery();
                }}
                autoFocus
                disabled={loading || !!error}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex gap-2">
                <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs font-semibold text-blue-900 mb-2">{s.preview}</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(parsed.filters).length > 0 ? (
                  Object.entries(parsed.filters).map(([key, value]) => (
                    value !== undefined && value !== "" && (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="text-xs font-medium"
                      >
                        {key}: {String(value)}
                      </Badge>
                    )
                  ))
                ) : (
                  <p className="text-xs text-blue-700">No filters extracted</p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[11px] font-semibold text-gray-600 mb-1">Reasoning</p>
              <p className="text-sm text-gray-700">{parsed.reasoning}</p>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="w-full text-blue-600 hover:text-blue-700"
              onClick={() => {
                setParsed(null);
                setError(null);
              }}
            >
              Try another search
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose render={<Button variant="ghost" />}>
            {s.cancel}
          </DialogClose>

          {!parsed ? (
            <Button
              onClick={parseQuery}
              disabled={!query.trim() || !!error || loading}
              className="gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? s.parsing : "Parse"}
            </Button>
          ) : (
            <Button onClick={handleApply} className="gap-2">
              {s.confirm}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
