"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useSavedSearches, useDeleteSearch } from "@/lib/hooks/use-saved-searches";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchCheck, Play, Trash2, Loader2, Search } from "lucide-react";

interface SavedSearchItem {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

const filterLabelMap: Record<string, string> = {
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
};

export default function SavedSearchesPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const ss = t.savedSearches;

  const { data, isLoading: loading } = useSavedSearches();
  const deleteMutation = useDeleteSearch();
  const searches = (data?.results ?? []) as SavedSearchItem[];

  const handleRemove = (id: string) => {
    deleteMutation.mutate(id);
  };
  const removing = deleteMutation.isPending ? (deleteMutation.variables ?? null) : null;

  const handleRunSearch = (filters: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
          {ss.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ss.subtitle} · {searches.length} {ss.count}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <Card className="py-16">
          <CardContent className="text-center">
            <Loader2 className="size-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">...</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && searches.length === 0 && (
        <Card className="py-20">
          <CardContent className="text-center">
            <SearchCheck className="size-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-6">{ss.noSearches}</p>
            <Link href="/search">
              <Button variant="outline" className="rounded-full">
                <Search className="size-4" />
                {ss.goToSearch}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Saved searches list */}
      {!loading && searches.length > 0 && (
        <div className="space-y-3">
          {searches.map((search) => {
            const filterEntries = Object.entries(search.filters).filter(
              ([, v]) => v && v !== "all"
            );
            return (
              <Card key={search.id} className="hover:shadow-md transition-shadow duration-300 py-0">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <SearchCheck className="size-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            {search.name}
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(search.createdAt).toLocaleDateString(
                              locale === "da" ? "da-DK" : "en-US",
                              { year: "numeric", month: "short", day: "numeric" }
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Filter pills */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {filterEntries.map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="font-medium text-xs">
                            <span className="text-muted-foreground">
                              {filterLabelMap[key] || key}:
                            </span>
                            {value}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleRunSearch(search.filters)}
                      >
                        <Play className="size-3.5" />
                        {ss.runSearch}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(search.id)}
                        disabled={removing === search.id}
                        className="text-muted-foreground hover:bg-red-50 hover:text-destructive"
                        title={ss.removed}
                      >
                        {removing === search.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
