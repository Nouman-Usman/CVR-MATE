"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useRecentCompanies } from "@/lib/hooks/use-recent-companies";
import { useSavedCvrSet, useSaveCompany, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";
import { companyColors } from "@/lib/constants/colors";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
            {r.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {r.subtitle} · {filtered.length} {r.found}
          </p>
        </div>
        <Button
          variant="outline"
          className="self-start rounded-full shadow-sm"
          onClick={() => forceRefresh()}
          disabled={isFetching}
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          {r.refresh}
        </Button>
      </div>

      {/* Filter */}
      <div className="mb-4 relative max-w-md">
        <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          className="rounded-full pl-10 pr-9"
          placeholder={r.filterPlaceholder}
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
        />
        {filter && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => handleFilterChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <Card className="py-16">
          <CardContent className="text-center">
            <Loader2 className="size-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">...</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {!isLoading && fetchError && (
        <Card className="py-16">
          <CardContent className="text-center">
            <AlertCircle className="size-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">{r.fetchError}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty / No filter match */}
      {!isLoading && !fetchError && companies.length === 0 && (
        <Card className="py-16">
          <CardContent className="text-center">
            <Building2 className="size-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {filter ? r.noFilter : r.noCompanies}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isLoading && !fetchError && companies.length > 0 && (
        <>
          <Card className="overflow-hidden hover:shadow-md transition-shadow duration-300 py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="px-4 sm:px-6 text-[10px] font-bold uppercase tracking-widest">
                      {r.table.company}
                    </TableHead>
                    <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest">
                      {r.table.cvr}
                    </TableHead>
                    <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest hidden md:table-cell">
                      {r.table.city}
                    </TableHead>
                    <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest hidden lg:table-cell">
                      {r.table.industry}
                    </TableHead>
                    <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest hidden md:table-cell">
                      {r.table.status}
                    </TableHead>
                    <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest hidden lg:table-cell">
                      {r.table.founded}
                    </TableHead>
                    <TableHead className="w-12 px-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c, idx) => {
                    const color = companyColors[idx % companyColors.length];
                    const initials = c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                    const isSaved = savedCvrs.has(c.cvr);
                    const rawResult = rawResults.find(
                      r => (r as unknown as { vat: number }).vat === Number(c.cvr)
                    ) as unknown as Record<string, unknown> | undefined;
                    return (
                      <TableRow
                        key={c.cvr}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/company/${c.cvr}`)}
                      >
                        <TableCell className="px-4 sm:px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                              <span className={`text-xs font-bold ${color.text}`}>{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors">
                                {c.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground md:hidden">
                                {c.city} · {c.cvr}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-sm text-muted-foreground tabular-nums">
                          {c.cvr}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-sm text-muted-foreground hidden md:table-cell">
                          {c.city || "\u2013"}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-sm text-muted-foreground hidden lg:table-cell truncate max-w-[180px]">
                          {c.industry || "\u2013"}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 hidden md:table-cell">
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                            {c.status || r.statusActive}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-sm text-muted-foreground tabular-nums hidden lg:table-cell">
                          {c.founded
                            ? new Date(c.founded).toLocaleDateString(
                                locale === "da" ? "da-DK" : "en-US"
                              )
                            : "\u2013"}
                        </TableCell>
                        <TableCell
                          className="px-3 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => rawResult && handleSaveToggle(c, rawResult)}
                            disabled={savingCvr === c.cvr}
                          >
                            <Heart
                              className={`size-4 ${
                                isSaved
                                  ? "text-red-500 fill-red-500"
                                  : "text-muted-foreground/40"
                              }`}
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3">
            <p className="text-sm text-muted-foreground">
              {r.showing} {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} {r.of}{" "}
              {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {pageNumbers.map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="icon"
                  className="rounded-full w-9 h-9"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
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
