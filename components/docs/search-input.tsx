"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/language-context";
import { ALL_DOCS } from "@/lib/docs/content";
import type { DocPage } from "@/lib/docs/types";

interface SearchResult {
  type: "page" | "section";
  slug: string;
  sectionId?: string;
  title: string;
  context?: string;
  href: string;
}

function buildIndex(): SearchResult[] {
  const index: SearchResult[] = [];
  for (const doc of Object.values(ALL_DOCS) as DocPage[]) {
    index.push({
      type: "page",
      slug: doc.slug,
      title: doc.title.en,
      href: `/docs/${doc.slug}`,
    });
    for (const section of doc.sections) {
      const bodyEn = section.body.en;
      const bodyText = Array.isArray(bodyEn) ? bodyEn.join(" ") : bodyEn;
      const featuresText = section.features?.en?.join(" ") ?? "";
      const stepsText = section.steps?.en?.join(" ") ?? "";
      index.push({
        type: "section",
        slug: doc.slug,
        sectionId: section.id,
        title: section.title.en,
        context: doc.title.en,
        href: `/docs/${doc.slug}#${section.id}`,
        // carry searchable text alongside — filtered below
        ...(({ _body: bodyText + " " + featuresText + " " + stepsText }) as Record<string, string>),
      });
    }
  }
  return index;
}

const INDEX_EN = buildIndex();

function buildLocalizedIndex(locale: string): SearchResult[] {
  const results: SearchResult[] = [];
  for (const doc of Object.values(ALL_DOCS) as DocPage[]) {
    const pageTitle = locale === "da" && doc.title.da ? doc.title.da : doc.title.en;
    const pageDesc = locale === "da" && doc.description.da ? doc.description.da : doc.description.en;
    results.push({
      type: "page",
      slug: doc.slug,
      title: pageTitle,
      href: `/docs/${doc.slug}`,
      context: pageDesc,
    });
    for (const section of doc.sections) {
      const sectionTitle = locale === "da" && section.title.da ? section.title.da : section.title.en;
      const bodyRaw = locale === "da" && section.body.da ? section.body.da : section.body.en;
      const bodyText = Array.isArray(bodyRaw) ? bodyRaw.join(" ") : bodyRaw;
      const featuresRaw = locale === "da" && section.features?.da ? section.features.da : section.features?.en ?? [];
      const stepsRaw = locale === "da" && section.steps?.da ? section.steps.da : section.steps?.en ?? [];
      results.push({
        type: "section",
        slug: doc.slug,
        sectionId: section.id,
        title: sectionTitle,
        context: pageTitle,
        href: `/docs/${doc.slug}#${section.id}`,
        // _body stored for searching
        ...({ _body: bodyText + " " + featuresRaw.join(" ") + " " + stepsRaw.join(" ") } as Record<string, string>),
      });
    }
  }
  return results;
}

function searchIndex(items: SearchResult[], query: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return items
    .filter((item) => {
      const haystack = [
        item.title,
        item.context ?? "",
        (item as SearchResult & { _body?: string })._body ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, 12);
}

void INDEX_EN; // suppress unused warning

export function DocsSearchInput() {
  const { locale, t } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = buildLocalizedIndex(locale);
  const results = searchIndex(index, query);
  const hasQuery = query.trim().length > 1;

  useEffect(() => {
    setFocusIndex(-1);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
      setQuery("");
      setFocusIndex(-1);
    },
    [router]
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusIndex >= 0 && results[focusIndex]) {
        navigate(results[focusIndex].href);
      } else if (results.length > 0) {
        navigate(results[0].href);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && hasQuery;

  return (
    <div ref={ref} className="relative px-3 mb-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t.docs.searchPlaceholder}
          className="pl-8 h-8 text-xs bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-blue-500"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full left-3 right-3 mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-500 text-center">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((result, i) => (
              <button
                key={result.href}
                onClick={() => navigate(result.href)}
                onMouseEnter={() => setFocusIndex(i)}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors ${
                  i === focusIndex ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                {result.type === "page" ? (
                  <FileText className="size-3.5 text-blue-400 shrink-0 mt-0.5" />
                ) : (
                  <Hash className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                )}
                <span className="min-w-0">
                  <span className="block text-xs text-slate-200 truncate">{result.title}</span>
                  {result.context && result.type === "section" && (
                    <span className="block text-[10px] text-slate-500 truncate">{result.context}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
