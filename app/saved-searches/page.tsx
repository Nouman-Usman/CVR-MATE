"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import { useSavedSearches, useDeleteSearch } from "@/lib/hooks/use-saved-searches";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  SearchCheck,
  Play,
  Trash2,
  Loader2,
  Search,
  X,
  Filter,
  Calendar,
  Bookmark,
} from "lucide-react";

interface SavedSearchItem {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

const filterLabelMap: Record<string, Record<string, string>> = {
  en: {
    name: "Name",
    industry_text: "Industry",
    industry_code: "Industry code",
    companyform_code: "Company form",
    zipcode: "Zip code",
    zipcode_list: "Region",
    municipality: "Municipality",
    life_start: "Founded after",
    employment_interval_low: "Min employees",
    size: "Size",
  },
  da: {
    name: "Navn",
    industry_text: "Branche",
    industry_code: "Branchekode",
    companyform_code: "Virksomhedsform",
    zipcode: "Postnummer",
    zipcode_list: "Region",
    municipality: "Kommune",
    life_start: "Stiftet efter",
    employment_interval_low: "Min. ansatte",
    size: "Størrelse",
  },
};

export default function SavedSearchesPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const ss = t.savedSearches;

  const { data, isLoading: loading } = useSavedSearches();
  const deleteMutation = useDeleteSearch();
  const searches = (data?.results ?? []) as SavedSearchItem[];

  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim()) return searches;
    const q = filter.toLowerCase();
    return searches.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        Object.values(s.filters).some(v => v.toLowerCase().includes(q))
    );
  }, [filter, searches]);

  const handleRemove = (id: string) => {
    deleteMutation.mutate(id);
  };
  const removing = deleteMutation.isPending ? (deleteMutation.variables ?? null) : null;

  const handleRunSearch = (filters: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    router.push(`/search?${params.toString()}`);
  };

  const labels = filterLabelMap[locale] ?? filterLabelMap.en;

  const totalFilters = searches.reduce((acc, s) => {
    return acc + Object.entries(s.filters).filter(([, v]) => v && v !== "all").length;
  }, 0);

  return (
    <DashboardLayout>
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
            {ss.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ss.subtitle}
          </p>
        </div>
        <Link
          href="/search"
          className={cn(buttonVariants({ variant: "outline" }), "self-start rounded-xl shadow-sm gap-2")}
        >
          <Search className="size-4" />
          {ss.goToSearch}
        </Link>
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      {!loading && searches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Bookmark className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {searches.length}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {ss.count}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <Filter className="size-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {totalFilters}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Aktive filtre" : "Active filters"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0 hidden sm:block">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Calendar className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {searches.length > 0
                    ? new Date(searches[searches.length - 1].createdAt).toLocaleDateString(
                        locale === "da" ? "da-DK" : "en-US",
                        { month: "short", day: "numeric" }
                      )
                    : "–"}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Seneste" : "Latest"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Search + count bar ────────────────────────────────── */}
      {!loading && searches.length > 0 && (
        <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 text-muted-foreground/50 absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              className="h-11 rounded-xl pl-11 pr-9 border-border/60 bg-muted/30 focus:bg-background transition-colors"
              placeholder={locale === "da" ? "Filtrer efter navn eller søgekriterier..." : "Filter by name or search criteria..."}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filter && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setFilter("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          {filtered.length > 0 && (
            <Badge variant="secondary" className="border-0 text-xs font-semibold h-7 px-3 shrink-0">
              {filtered.length} {ss.count}
            </Badge>
          )}
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────── */}
      {loading && <InlineLoader />}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!loading && searches.length === 0 && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <SearchCheck className="size-7 text-muted-foreground/30" />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {ss.noSearches}
            </p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">
              {locale === "da"
                ? "Gem søgninger fra søgesiden for hurtig adgang."
                : "Save searches from the search page for quick access."}
            </p>
            <Link
              href="/search"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-xl gap-2")}
            >
              <Search className="size-4" />
              {ss.goToSearch}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── No filter match ────────────────────────────────────── */}
      {!loading && searches.length > 0 && filtered.length === 0 && filter && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="size-7 text-muted-foreground/30" />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {locale === "da" ? "Ingen match" : "No matches"}
            </p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {locale === "da"
                ? "Ingen gemte søgninger matcher dit filter."
                : "No saved searches match your filter."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Saved searches table ──────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-sm py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="pl-5 sm:pl-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {ss.table.name}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                  {ss.table.filters}
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                  {ss.table.created}
                </TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((search) => {
                const filterEntries = Object.entries(search.filters).filter(
                  ([, v]) => v && v !== "all"
                );

                return (
                  <TableRow
                    key={search.id}
                    className="group border-border/30"
                  >
                    <TableCell className="pl-5 sm:pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                          <SearchCheck className="size-5 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {search.name}
                          </p>
                          {/* Mobile: show filters inline */}
                          <div className="flex flex-wrap gap-1 mt-1 sm:hidden">
                            {filterEntries.slice(0, 2).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="text-[10px] font-medium h-5 border-0">
                                {labels[key] || key}: {value}
                              </Badge>
                            ))}
                            {filterEntries.length > 2 && (
                              <Badge variant="secondary" className="text-[10px] font-medium h-5 border-0">
                                +{filterEntries.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1.5 max-w-[320px]">
                        {filterEntries.map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs font-medium border-0">
                            <span className="text-muted-foreground mr-1">{labels[key] || key}:</span>
                            {value}
                          </Badge>
                        ))}
                        {filterEntries.length === 0 && (
                          <span className="text-xs text-muted-foreground/50">–</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-muted-foreground hidden md:table-cell">
                      {new Date(search.createdAt).toLocaleDateString(
                        locale === "da" ? "da-DK" : "en-US",
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </TableCell>
                    <TableCell className="py-4 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl gap-1.5"
                          onClick={() => handleRunSearch(search.filters)}
                        >
                          <Play className="size-3.5" />
                          <span className="hidden sm:inline">{ss.runSearch}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemove(search.id)}
                          disabled={removing === search.id}
                          className="rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5"
                          title={ss.removed}
                        >
                          {removing === search.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </DashboardLayout>
  );
}
