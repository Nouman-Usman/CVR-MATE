"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";

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

  const [searches, setSearches] = useState<SavedSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/saved-searches");
        if (res.ok) {
          const data = await res.json();
          setSearches(data.results || []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    setRemoving(id);
    try {
      const res = await fetch(`/api/saved-searches?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSearches((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // Silently fail
    } finally {
      setRemoving(null);
    }
  }, []);

  const handleRunSearch = (filters: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
          {ss.title}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {ss.subtitle} · {searches.length} {ss.count}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-400 font-medium">...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && searches.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 block">
            saved_search
          </span>
          <p className="text-slate-400 font-medium mb-6">{ss.noSearches}</p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">search</span>
            {ss.goToSearch}
          </Link>
        </div>
      )}

      {/* Saved searches list */}
      {!loading && searches.length > 0 && (
        <div className="space-y-3">
          {searches.map((search) => {
            const filterEntries = Object.entries(search.filters).filter(
              ([, v]) => v && v !== "all"
            );
            return (
              <div
                key={search.id}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-blue-600 text-xl">
                          saved_search
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {search.name}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {new Date(search.createdAt).toLocaleDateString(
                            locale === "da" ? "da-DK" : "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Filter pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {filterEntries.map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100"
                        >
                          <span className="text-slate-400">
                            {filterLabelMap[key] || key}:
                          </span>
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRunSearch(search.filters)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">
                        play_arrow
                      </span>
                      {ss.runSearch}
                    </button>
                    <button
                      onClick={() => handleRemove(search.id)}
                      disabled={removing === search.id}
                      className="p-2 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                      title={ss.removed}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {removing === search.id
                          ? "progress_activity"
                          : "delete"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
