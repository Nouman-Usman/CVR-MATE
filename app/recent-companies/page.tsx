"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import { useRecentCompanies } from "@/lib/hooks/use-recent-companies";
import { useSavedCvrSet, useSaveCompany, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";
import { companyColors } from "@/lib/constants/colors";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
  Building2,
  Heart,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const PAGE_SIZE = 20;

interface Company {
  cvr: string;
  name: string;
  city: string;
  industry: string;
  status: string;
  founded: string;
  employees: string;
}

function mapCvrCompany(c: Record<string, unknown>): Company {
  const comp = c as {
    vat?: number;
    life?: { name?: string; start?: string };
    address?: { cityname?: string };
    industry?: { primary?: { text?: string } };
    companystatus?: { text?: string };
    employment?: { months?: { amount?: number | null }[] };
  };

  const latestEmployment = comp.employment?.months?.[0]?.amount;

  return {
    cvr: String(comp.vat ?? ""),
    name: comp.life?.name ?? "",
    city: comp.address?.cityname ?? "",
    industry: comp.industry?.primary?.text ?? "",
    status: comp.companystatus?.text ?? "",
    founded: comp.life?.start ?? "",
    employees: latestEmployment != null ? String(latestEmployment) : "\u2013",
  };
}

export default function RecentCompaniesPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const r = t.recent;

  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error: fetchError, forceRefresh, isFetching } = useRecentCompanies(7);
  const rawResults = data?.results ?? [];

  const allCompanies = useMemo(() => rawResults.map(r => mapCvrCompany(r as unknown as Record<string, unknown>)), [rawResults]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return allCompanies;
    const q = filter.toLowerCase();
    return allCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cvr.includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
    );
  }, [filter, allCompanies]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const companies = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const savedCvrs = useSavedCvrSet();
  const saveCompanyMutation = useSaveCompany();
  const unsaveCompanyMutation = useUnsaveCompany();

  const handleSaveToggle = (c: Company, rawResult: Record<string, unknown>) => {
    if (savedCvrs.has(c.cvr)) {
      unsaveCompanyMutation.mutate(c.cvr);
    } else {
      saveCompanyMutation.mutate({ vat: c.cvr, name: c.name, rawData: rawResult });
    }
  };
  const savingCvr = saveCompanyMutation.isPending
    ? (saveCompanyMutation.variables?.vat ?? null)
    : unsaveCompanyMutation.isPending
      ? (unsaveCompanyMutation.variables ?? null)
      : null;

  const handleFilterChange = (val: string) => {
    setFilter(val);
    setPage(1);
  };

  return (
    <DashboardLayout>
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
            {r.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {r.subtitle}
          </p>
        </div>
        <Button
          variant="outline"
          className="self-start rounded-xl shadow-sm gap-2"
          onClick={() => forceRefresh()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          {r.refresh}
        </Button>
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      {!isLoading && !fetchError && allCompanies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Building2 className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {allCompanies.length}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Virksomheder" : "Companies"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {new Set(allCompanies.map(c => c.city).filter(Boolean)).size}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Byer" : "Cities"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <Sparkles className="size-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {new Set(allCompanies.map(c => c.industry).filter(Boolean)).size}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Brancher" : "Industries"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Heart className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums font-[family-name:var(--font-manrope)]">
                  {allCompanies.filter(c => savedCvrs.has(c.cvr)).length}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {locale === "da" ? "Gemt" : "Saved"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Search + count bar ────────────────────────────────── */}
      <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 text-muted-foreground/50 absolute left-4 top-1/2 -translate-y-1/2" />
          <Input
            className="h-11 rounded-xl pl-11 pr-9 border-border/60 bg-muted/30 focus:bg-background transition-colors"
            placeholder={r.filterPlaceholder}
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
          />
          {filter && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleFilterChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        {!isLoading && !fetchError && filtered.length > 0 && (
          <Badge variant="secondary" className="border-0 text-xs font-semibold h-7 px-3 shrink-0">
            {filtered.length} {r.found}
          </Badge>
        )}
      </div>

      {/* ── Loading ──────────────────────────────────────────── */}
      {isLoading && <InlineLoader />}

      {/* ── Error ─────────────────────────────────────────────── */}
      {!isLoading && fetchError && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/5 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="size-7 text-destructive/40" />
            </div>
            <p className="text-foreground font-semibold mb-1">{locale === "da" ? "Noget gik galt" : "Something went wrong"}</p>
            <p className="text-muted-foreground text-sm mb-5">{r.fetchError}</p>
            <Button variant="outline" onClick={() => forceRefresh()} className="rounded-xl gap-2">
              <RefreshCw className="size-4" />
              {locale === "da" ? "Prøv igen" : "Try again"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Empty / No filter match ───────────────────────────── */}
      {!isLoading && !fetchError && companies.length === 0 && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              {filter ? (
                <Search className="size-7 text-muted-foreground/30" />
              ) : (
                <Building2 className="size-7 text-muted-foreground/30" />
              )}
            </div>
            <p className="text-foreground font-semibold mb-1">
              {filter
                ? (locale === "da" ? "Ingen match" : "No matches")
                : (locale === "da" ? "Ingen virksomheder endnu" : "No companies yet")}
            </p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {filter ? r.noFilter : r.noCompanies}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Company list (card-based rows) ────────────────────── */}
      {!isLoading && !fetchError && companies.length > 0 && (
        <>
          <Card className="overflow-hidden border-0 shadow-sm py-0">
            <div className="divide-y divide-border/30">
              {companies.map((c, idx) => {
                const color = companyColors[idx % companyColors.length];
                const initials = c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                const isSaved = savedCvrs.has(c.cvr);
                const rawResult = rawResults.find(
                  r => (r as unknown as { vat: number }).vat === Number(c.cvr)
                ) as unknown as Record<string, unknown> | undefined;

                return (
                  <div
                    key={c.cvr}
                    className="group flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/company/${c.cvr}`)}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm transition-shadow group-hover:shadow-md",
                      color.bg
                    )}>
                      <span className={cn("text-xs font-bold", color.text)}>{initials}</span>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {c.name}
                        </p>
                        <Badge variant="secondary" className="hidden sm:flex bg-emerald-50 text-emerald-700 border-0 text-[9px] font-bold uppercase tracking-wider h-5 shrink-0">
                          {c.status || r.statusActive}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="tabular-nums">{c.cvr}</span>
                        {c.city && (
                          <span className="hidden sm:flex items-center gap-1">
                            <MapPin className="size-3" />
                            {c.city}
                          </span>
                        )}
                        {c.employees !== "\u2013" && (
                          <span className="hidden md:flex items-center gap-1">
                            <Users className="size-3" />
                            {c.employees}
                          </span>
                        )}
                        {c.founded && (
                          <span className="hidden lg:flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(c.founded).toLocaleDateString(
                              locale === "da" ? "da-DK" : "en-US",
                              { year: "numeric", month: "short" }
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Industry badge */}
                    {c.industry && (
                      <Badge variant="secondary" className="hidden lg:flex border-0 text-[10px] font-medium max-w-[180px] truncate shrink-0 h-6">
                        {c.industry}
                      </Badge>
                    )}

                    {/* Save button */}
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onClick={() => rawResult && handleSaveToggle(c, rawResult)}
                        disabled={savingCvr === c.cvr}
                      >
                        <Heart className={cn(
                          "size-4 transition-all duration-200",
                          isSaved
                            ? "text-red-500 fill-red-500"
                            : "text-muted-foreground/30 group-hover:text-red-300"
                        )} />
                      </Button>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="size-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all shrink-0" />
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ── Pagination ──────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between mt-5 gap-3">
            <p className="text-sm text-muted-foreground">
              {r.showing}{" "}
              <span className="font-semibold text-foreground">{(page - 1) * PAGE_SIZE + 1}</span>
              –
              <span className="font-semibold text-foreground">{Math.min(page * PAGE_SIZE, filtered.length)}</span>
              {" "}{r.of}{" "}
              <span className="font-semibold text-foreground">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full w-9 h-9"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {pageNumbers.map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "ghost"}
                  size="icon"
                  className={cn(
                    "rounded-full w-9 h-9 text-sm font-semibold",
                    p === page && "shadow-sm"
                  )}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="rounded-full w-9 h-9"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
