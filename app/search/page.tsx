"use client";

import { useState, useCallback, useEffect, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useSearchStore, type SearchFiltersState } from "@/lib/stores/search-store";
import { useSearchCompanies } from "@/lib/hooks/use-search";
import { useSavedCvrSet, useSaveCompany, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";
import { useSaveSearch } from "@/lib/hooks/use-saved-searches";

import { companyColors } from "@/lib/constants/colors";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  ChevronDown,
  X,
  Heart,
  ExternalLink,
  Loader2,
  AlertCircle,
  Building2,
  SearchX,
  Bookmark,
  Download,
  SlidersHorizontal,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

interface Company {
  cvr: string;
  name: string;
  city: string;
  industry: string;
  industryCode: string;
  status: string;
  founded: string;
  employees: string;
  form: string;
}

function mapCvrCompany(c: Record<string, unknown>): Company {
  const comp = c as {
    vat?: number;
    life?: { name?: string; start?: string };
    address?: { cityname?: string; zipcode?: number };
    industry?: { primary?: { text?: string; code?: number } };
    companystatus?: { text?: string };
    companyform?: { description?: string };
    employment?: { months?: { amount?: number | null }[] };
  };

  const latestEmployment = comp.employment?.months?.[0]?.amount;

  return {
    cvr: String(comp.vat ?? ""),
    name: comp.life?.name ?? "",
    city: comp.address?.cityname ?? "",
    industry: comp.industry?.primary?.text ?? "",
    industryCode: String(comp.industry?.primary?.code ?? ""),
    status: comp.companystatus?.text ?? "",
    founded: comp.life?.start ?? "",
    employees: latestEmployment != null ? String(latestEmployment) : "\u2013",
    form: comp.companyform?.description ?? "",
  };
}

// ── Range slider (custom — no shadcn equivalent) ────────────────────

function RangeSlider({
  label,
  min,
  max,
  minVal,
  maxVal,
  onMinChange,
  onMaxChange,
  formatMax,
}: {
  label: string;
  min: number;
  max: number;
  minVal: number;
  maxVal: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
  formatMax: string;
}) {
  const leftPercent = ((minVal - min) / (max - min)) * 100;
  const rightPercent = ((maxVal - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
        <span className="text-xs font-bold text-foreground tabular-nums">
          {minVal.toLocaleString()} – {maxVal >= max ? formatMax : maxVal.toLocaleString()}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute h-1.5 w-full bg-slate-100 rounded-full" />
        <div
          className="absolute h-1.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
          style={{ left: `${leftPercent}%`, width: `${rightPercent - leftPercent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={minVal}
          onChange={(e) => onMinChange(Math.min(Number(e.target.value), maxVal - 1))}
          className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxVal}
          onChange={(e) => onMaxChange(Math.max(Number(e.target.value), minVal + 1))}
          className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/50 tabular-nums font-medium">
        <span>{min.toLocaleString()}</span>
        <span>{formatMax}</span>
      </div>
    </div>
  );
}

// ── Lookup tables ───────────────────────────────────────────────────

const industryCodeToText: Record<string, string> = {
  "46": "Engroshandel",
  "47": "Detailhandel",
  "62": "Computerprogrammering",
  "41": "Opførelse af bygninger",
  "56": "Restauranter",
  "86": "Sundhedsvæsen",
  "70": "Virksomhedsrådgivning",
  "43": "Specialiseret bygge",
  "68": "fast ejendom",
};

const companyFormDescMap: Record<string, string> = {
  aps: "APS",
  "a/s": "A/S",
  ivs: "IVS",
  "i/s": "I/S",
  enkeltmandsvirksomhed: "ENK",
};

const regionZipcodeMap: Record<string, string> = {
  hovedstaden: "1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2450,2500,2600,2605,2610,2620,2625,2630,2635,2640,2650,2660,2665,2670,2680,2690,2700,2720,2730,2740,2750,2760,2765,2770,2791,2800,2820,2830,2840,2850,2860,2870,2880,2900,2920,2930,2942,2950,2960,2970,2980,2990,3000,3050,3060,3070,3080,3100,3120,3140,3150,3200,3210,3230,3250,3300,3310,3320,3330,3360,3370,3390,3400,3450,3460,3480,3490,3500,3520,3540",
  midtjylland: "7400,7430,7441,7442,7451,7470,7480,7490,7500,7540,7550,7560,7570,7600,7620,7650,7660,7670,7680,7700,7730,7741,7742,7752,7755,7760,7770,7790,8000,8200,8210,8220,8230,8240,8250,8260,8270,8300,8305,8310,8320,8330,8340,8350,8355,8360,8370,8380,8381,8382,8400,8410,8420,8444,8450,8462,8464,8471,8472,8500,8520,8530,8541,8543,8544,8550,8560,8570,8581,8585,8586,8592,8600,8620,8632,8641,8643,8653,8654,8660,8670,8680,8700,8721,8722,8723,8732,8740,8751,8752,8762,8763,8765,8766,8781,8783,8800,8830,8831,8832,8840,8850,8860,8870,8881,8882,8883,8900,8920,8930,8940,8950,8960,8961,8963,8970,8981,8983,8990",
  syddanmark: "5000,5200,5210,5220,5230,5240,5250,5260,5270,5290,5300,5320,5330,5350,5370,5380,5390,5400,5450,5462,5463,5464,5466,5471,5474,5485,5491,5492,5500,5540,5550,5560,5580,5591,5592,5600,5610,5620,5631,5642,5672,5683,5690,5700,5750,5762,5771,5772,5792,5800,5853,5854,5856,5863,5871,5874,5881,5882,5883,5884,5892,5900,5932,5935,5943,5953,5960,5970,5985,6000,6040,6051,6052,6064,6070,6091,6092,6093,6094,6100,6200,6230,6240,6261,6270,6280,6300,6310,6320,6330,6340,6360,6372,6392,6400,6430,6470,6500,6510,6520,6534,6535,6541,6560,6580,6600,6621,6622,6623,6630,6640,6650,6660,6670,6682,6683,6690,6700,6705,6710,6715,6720,6731,6740,6752,6753,6760,6771,6780,6792,6800,6818,6823,6830,6840,6851,6852,6853,6854,6855,6857,6862,6870,6880",
  nordjylland: "7700,7730,7741,7742,7752,7755,7760,7770,7790,7800,7830,7840,7850,7860,7870,7884,7900,7950,7960,7970,7980,7990,7992,7993,7996,7998,8960,8961,8963,8970,8981,8983,8990,9000,9200,9210,9220,9230,9240,9260,9270,9280,9293,9300,9310,9320,9330,9340,9352,9362,9370,9380,9381,9382,9400,9430,9440,9460,9480,9490,9492,9493,9500,9510,9520,9530,9541,9550,9560,9574,9575,9600,9610,9620,9631,9632,9640,9670,9681,9690,9700,9740,9750,9760,9800,9830,9850,9870,9881,9900,9940,9970,9981,9982,9990",
  sjaelland: "4000,4030,4040,4050,4060,4070,4100,4130,4140,4160,4171,4173,4174,4180,4190,4200,4220,4230,4241,4242,4243,4250,4261,4262,4270,4281,4291,4293,4295,4296,4300,4320,4330,4340,4350,4360,4370,4390,4400,4420,4440,4450,4460,4470,4480,4490,4500,4520,4532,4534,4540,4550,4560,4571,4572,4573,4581,4583,4591,4592,4593,4600,4621,4622,4623,4632,4640,4652,4653,4654,4660,4671,4672,4673,4681,4682,4683,4684,4690,4700,4720,4733,4735,4736,4750,4760,4771,4772,4773,4780,4791,4792,4793,4800,4840,4850,4862,4863,4871,4872,4873,4880,4891,4892,4894,4895,4900,4912,4913,4920,4930,4941,4942,4943,4944,4951,4952,4953,4960,4970,4983,4990",
};

function foundedToDate(period: string): string | null {
  if (period === "all") return null;
  const map: Record<string, number> = { last30: 30, last90: 90, last365: 365, last3y: 1095 };
  const days = map[period];
  if (!days) return null;
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().split("T")[0];
}

function sizeToEmploymentRange(s: string): { low?: string } {
  if (s === "all") return {};
  if (s === "100+") return { low: "100" };
  const [lo] = s.split("-");
  return { low: lo };
}

// ── Select wrapper (styled native select) ───────────────────────────

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:ring-2 focus:ring-ring/20 focus:border-ring outline-none appearance-none transition-colors"
    >
      {children}
    </select>
  );
}

// ── Main page ───────────────────────────────────────────────────────

export default function SearchPageWrapper() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}

function SearchPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const urlParams = useSearchParams();
  const s = t.search;

  const store = useSearchStore();
  const {
    query, industryText, industryCode, companyForm, size,
    zipcode, region, foundedPeriod, revenueMin, revenueMax,
    profitMin, profitMax, employeesMin, employeesMax,
    showFilters, page, scrollY, selected, hasSearched,
    setFilter, setPage, setScrollY, setHasSearched, setShowFilters,
    toggleSelect, selectAll, clearSelected, resetAll,
  } = store;

  const [committedParams, setCommittedParams] = useState<URLSearchParams | null>(null);

  const buildSearchParams = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("name", query);
    if (industryCode !== "all") {
      const term = industryCodeToText[industryCode];
      if (term) params.set("industry_text", term);
    } else if (industryText) {
      params.set("industry_text", industryText);
    }
    if (companyForm !== "all") {
      const desc = companyFormDescMap[companyForm];
      if (desc) params.set("companyform_description", desc);
    }
    if (zipcode) params.set("zipcode", zipcode);
    if (!zipcode && region !== "all") {
      const zips = regionZipcodeMap[region];
      if (zips) params.set("zipcode_list", zips);
    }
    const lifeStart = foundedToDate(foundedPeriod);
    if (lifeStart) params.set("life_start", lifeStart);
    if (employeesMin > 0) {
      params.set("employment_interval_low", String(employeesMin));
    } else {
      const empRange = sizeToEmploymentRange(size);
      if (empRange.low) params.set("employment_interval_low", empRange.low);
    }
    if (employeesMax < 5000) params.set("seg_employees_max", String(employeesMax));
    if (revenueMin > 0) params.set("seg_revenue_min", String(revenueMin));
    if (revenueMax < 1000) params.set("seg_revenue_max", String(revenueMax));
    if (profitMin > 0) params.set("seg_profit_min", String(profitMin));
    if (profitMax < 1000) params.set("seg_profit_max", String(profitMax));
    return params.toString() ? params : null;
  }, [query, industryText, industryCode, companyForm, zipcode, region, foundedPeriod, size, employeesMin, employeesMax, revenueMin, revenueMax, profitMin, profitMax]);

  const {
    data: searchData,
    isLoading,
    error: searchError,
    isFetching,
  } = useSearchCompanies(committedParams, page, hasSearched);

  const rawResults = searchData?.results ?? [];
  const results = useMemo(() => rawResults.map(mapCvrCompany), [rawResults]);
  const totalResults = searchData?.total ?? 0;
  const hasMore = searchData?.hasMore ?? false;

  const savedCvrs = useSavedCvrSet();
  const saveCompanyMutation = useSaveCompany();
  const unsaveCompanyMutation = useUnsaveCompany();

  const saveSearchMutation = useSaveSearch();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [localError, setLocalError] = useState("");

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const p = urlParams;
    let hasParams = false;
    const name = p.get("name");
    if (name) { setFilter("query", name); hasParams = true; }
    const it = p.get("industry_text");
    if (it) { setFilter("industryText", it); hasParams = true; }
    const ic = p.get("industry_code");
    if (ic) { setFilter("industryCode", ic); hasParams = true; }
    const cf = p.get("companyForm");
    if (cf) { setFilter("companyForm", cf); hasParams = true; }
    const sz = p.get("size");
    if (sz) { setFilter("size", sz); hasParams = true; }
    const zc = p.get("zipcode");
    if (zc) { setFilter("zipcode", zc); hasParams = true; }
    const rg = p.get("region");
    if (rg) { setFilter("region", rg); hasParams = true; }
    const fp = p.get("foundedPeriod");
    if (fp) { setFilter("foundedPeriod", fp); hasParams = true; }
    const em = p.get("employeesMin");
    if (em) { setFilter("employeesMin", Number(em)); hasParams = true; }
    if (hasParams) {
      setHasSearched(true);
      setPage(1);
      setTimeout(() => {
        setCommittedParams(buildSearchParams());
      }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasSearched && results.length > 0 && scrollY > 0 && !isLoading) {
      window.scrollTo(0, scrollY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length]);

  useEffect(() => {
    return () => { setScrollY(window.scrollY); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(() => {
    setLocalError("");
    clearSelected();
    const params = buildSearchParams();
    if (!params) {
      setLocalError(s.noFilter);
      return;
    }
    setPage(1);
    setHasSearched(true);
    setCommittedParams(params);
  }, [buildSearchParams, s, setPage, setHasSearched, clearSelected]);

  const handleLoadMore = useCallback(() => { setPage(page + 1); }, [page, setPage]);

  const handleSaveCompany = useCallback((c: Company, rawResult: Record<string, unknown>) => {
    if (savedCvrs.has(c.cvr)) {
      unsaveCompanyMutation.mutate(c.cvr);
    } else {
      saveCompanyMutation.mutate({ vat: c.cvr, name: c.name, rawData: rawResult });
    }
  }, [savedCvrs, saveCompanyMutation, unsaveCompanyMutation]);

  const clearFilters = useCallback(() => {
    resetAll();
    setCommittedParams(null);
    setLocalError("");
  }, [resetAll]);

  const toggleAll = useCallback(() => {
    if (selected.length === results.length) clearSelected();
    else selectAll(results.map((r) => r.cvr));
  }, [selected.length, results, clearSelected, selectAll]);

  const getCurrentFilters = useCallback((): Record<string, string> => {
    const filters: Record<string, string> = {};
    if (query) filters.name = query;
    if (industryText) filters.industry_text = industryText;
    if (industryCode !== "all") filters.industry_code = industryCode;
    if (companyForm !== "all") filters.companyForm = companyForm;
    if (size !== "all") filters.size = size;
    if (zipcode) filters.zipcode = zipcode;
    if (region !== "all") filters.region = region;
    if (foundedPeriod !== "all") filters.foundedPeriod = foundedPeriod;
    if (employeesMin > 0) filters.employeesMin = String(employeesMin);
    return filters;
  }, [query, industryText, industryCode, companyForm, size, zipcode, region, foundedPeriod, employeesMin]);

  const handleSaveSearch = useCallback(async () => {
    if (!saveSearchName.trim()) return;
    saveSearchMutation.mutate(
      { name: saveSearchName.trim(), filters: getCurrentFilters() },
      {
        onSuccess: () => {
          setShowSaveModal(false);
          setSaveSearchName("");
        },
      }
    );
  }, [saveSearchName, getCurrentFilters, saveSearchMutation]);

  const foundedOptions = [
    { code: "all", label: locale === "da" ? "Vælg periode" : "Select period" },
    { code: "last30", label: locale === "da" ? "Sidste 30 dage" : "Last 30 days" },
    { code: "last90", label: locale === "da" ? "Sidste 90 dage" : "Last 90 days" },
    { code: "last365", label: locale === "da" ? "Sidste år" : "Last year" },
    { code: "last3y", label: locale === "da" ? "Sidste 3 år" : "Last 3 years" },
  ];

  const error = localError || (searchError ? s.searchError : "");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const savingCvr = saveCompanyMutation.isPending ? (saveCompanyMutation.variables?.vat ?? null) : (unsaveCompanyMutation.isPending ? unsaveCompanyMutation.variables ?? null : null);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (industryText) count++;
    if (industryCode !== "all") count++;
    if (companyForm !== "all") count++;
    if (size !== "all") count++;
    if (zipcode) count++;
    if (region !== "all") count++;
    if (foundedPeriod !== "all") count++;
    if (employeesMin > 0 || employeesMax < 5000) count++;
    if (revenueMin > 0 || revenueMax < 1000) count++;
    if (profitMin > 0 || profitMax < 1000) count++;
    return count;
  }, [industryText, industryCode, companyForm, size, zipcode, region, foundedPeriod, employeesMin, employeesMax, revenueMin, revenueMax, profitMin, profitMax]);

  return (
    <DashboardLayout>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)]">
          {s.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{s.subtitle}</p>
      </div>

      {/* ── Search card ──────────────────────────────────────── */}
      <Card className="mb-6 border-0 shadow-sm py-0 overflow-visible">
        <CardContent className="p-5 sm:p-6">
          {/* Search bar row */}
          <div className="flex gap-2 sm:gap-3 items-center">
            <div className="relative flex-1">
              <Search className="size-5 text-muted-foreground/50 absolute left-4 top-1/2 -translate-y-1/2" />
              <Input
                className="h-12 pl-12 pr-4 text-sm rounded-xl border-border/60 bg-muted/30 focus:bg-background transition-colors"
                placeholder={s.searchPlaceholder}
                value={query}
                onChange={(e) => setFilter("query", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {/* Search button */}
            <Button
              variant="gradient"
              size="lg"
              className="h-12 px-6 rounded-xl shrink-0 gap-2 font-bold"
              onClick={handleSearch}
              disabled={isLoading || isFetching}
            >
              {(isLoading || isFetching) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {s.searchButton}
            </Button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="mt-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer group transition-colors"
          >
            <SlidersHorizontal className="size-4" />
            {s.filters.title}
            {activeFilterCount > 0 && (
              <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-bold h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className={cn(
              "size-4 transition-transform duration-300",
              showFilters && "rotate-180"
            )} />
          </button>

          {/* ── Filters panel ─────────────────────────────────── */}
          {showFilters && (
            <div className="mt-4 pt-5 border-t border-border/40 animate-slide-down">
              {/* Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.filters.industry}</Label>
                  <Input
                    className="h-10"
                    placeholder={s.filters.industryPlaceholder}
                    value={industryText}
                    onChange={(e) => setFilter("industryText", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.filters.industryCode}</Label>
                  <FilterSelect value={industryCode} onChange={(v) => setFilter("industryCode", v)}>
                    <option value="all">{s.filters.industryCodePlaceholder}</option>
                    {s.industries.filter((i) => i.code !== "all").map((ind) => (
                      <option key={ind.code} value={ind.code}>{ind.label}</option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.filters.companyForm}</Label>
                  <FilterSelect value={companyForm} onChange={(v) => setFilter("companyForm", v)}>
                    <option value="all">{s.filters.companyFormPlaceholder}</option>
                    {s.companyForms.filter((f) => f.code !== "all").map((f) => (
                      <option key={f.code} value={f.code}>{f.label}</option>
                    ))}
                  </FilterSelect>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.filters.size}</Label>
                  <FilterSelect value={size} onChange={(v) => setFilter("size", v)}>
                    <option value="all">{s.filters.sizePlaceholder}</option>
                    {s.sizes.filter((sz) => sz.code !== "all").map((sz) => (
                      <option key={sz.code} value={sz.code}>{sz.label}</option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.filters.zipcode}</Label>
                  <Input
                    className="h-10"
                    placeholder={s.filters.zipcodePlaceholder}
                    value={zipcode}
                    onChange={(e) => setFilter("zipcode", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.filters.region}</Label>
                  <FilterSelect value={region} onChange={(v) => setFilter("region", v)}>
                    <option value="all">{s.filters.regionPlaceholder}</option>
                    {s.regions.filter((r) => r.code !== "all").map((reg) => (
                      <option key={reg.code} value={reg.code}>{reg.label}</option>
                    ))}
                  </FilterSelect>
                </div>
              </div>

              {/* Row 3 — founded */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.filters.foundedDate}</Label>
                  <FilterSelect value={foundedPeriod} onChange={(v) => setFilter("foundedPeriod", v)}>
                    {foundedOptions.map((o) => (
                      <option key={o.code} value={o.code}>{o.label}</option>
                    ))}
                  </FilterSelect>
                </div>
              </div>

              {/* Segmentation sliders */}
              <div className="pt-5 border-t border-border/40">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <SlidersHorizontal className="size-3.5 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{s.filters.segmentation}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                  <RangeSlider label={s.filters.revenue} min={0} max={1000} minVal={revenueMin} maxVal={revenueMax} onMinChange={(v) => setFilter("revenueMin", v)} onMaxChange={(v) => setFilter("revenueMax", v)} formatMax="1 bn+" />
                  <RangeSlider label={s.filters.grossProfit} min={0} max={1000} minVal={profitMin} maxVal={profitMax} onMinChange={(v) => setFilter("profitMin", v)} onMaxChange={(v) => setFilter("profitMax", v)} formatMax="1 bn+" />
                  <RangeSlider label={s.filters.employees} min={0} max={5000} minVal={employeesMin} maxVal={employeesMax} onMinChange={(v) => setFilter("employeesMin", v)} onMaxChange={(v) => setFilter("employeesMax", v)} formatMax="5,000+" />
                </div>
              </div>

              <div className="flex justify-end mt-5">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1.5">
                  <RotateCcw className="size-3.5" />
                  {s.filters.clearFilters}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Error alert ──────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive" className="mb-4 animate-fade-in-up">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Selected actions bar ──────────────────────────────── */}
      {selected.length > 0 && (
        <div className="bg-primary/5 border border-primary/10 rounded-xl px-5 py-3.5 mb-4 flex items-center justify-between animate-fade-in-up">
          <p className="text-sm font-semibold text-primary">
            {selected.length} {s.selected}
          </p>
          <Button size="sm" className="rounded-full gap-2">
            <Download className="size-3.5" />
            {s.export}
          </Button>
        </div>
      )}

      {/* ── Loading state ────────────────────────────────────── */}
      {isLoading && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <Loader2 className="size-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">{s.searchButton}...</p>
          </CardContent>
        </Card>
      )}

      {/* ── Results ──────────────────────────────────────────── */}
      {!isLoading && hasSearched && results.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-sm py-0">
          {/* Results header */}
          <div className="px-5 sm:px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{results.length}</span>
                {totalResults > results.length && (
                  <span className="text-muted-foreground/60"> / {totalResults}</span>
                )}{" "}
                {s.results}
              </p>
              {isFetching && <Loader2 className="size-3.5 text-primary animate-spin" />}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSaveModal(true)}
              className="gap-1.5 text-muted-foreground hover:text-primary"
            >
              <Bookmark className="size-4" />
              {s.saveSearch}
            </Button>
          </div>

          {/* Results table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="px-4 sm:px-6 w-10">
                    <Checkbox
                      checked={selectedSet.size === results.length && results.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest">{s.table.company}</TableHead>
                  <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest">{s.table.cvr}</TableHead>
                  <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest hidden md:table-cell">{s.table.city}</TableHead>
                  <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest hidden lg:table-cell">{s.table.industry}</TableHead>
                  <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest hidden md:table-cell">{s.table.employees}</TableHead>
                  <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest hidden md:table-cell">{s.table.status}</TableHead>
                  <TableHead className="px-4 text-[10px] font-bold uppercase tracking-widest hidden lg:table-cell">{s.table.founded}</TableHead>
                  <TableHead className="w-10 px-2" />
                  <TableHead className="w-10 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody className="animate-stagger">
                {results.map((c, idx) => {
                  const color = companyColors[idx % companyColors.length];
                  const initials = c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  const isSaved = savedCvrs.has(c.cvr);
                  const isSaving = savingCvr === c.cvr;
                  return (
                    <TableRow
                      key={c.cvr}
                      className="group hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => router.push(`/company/${c.cvr}`)}
                    >
                      <TableCell className="px-4 sm:px-6" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedSet.has(c.cvr)}
                          onCheckedChange={() => toggleSelect(c.cvr)}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm", color.bg)}>
                            <span className={cn("text-xs font-bold", color.text)}>{initials}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground md:hidden">{c.city} · {c.employees}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-muted-foreground tabular-nums">{c.cvr}</TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{c.city}</TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-muted-foreground hidden lg:table-cell truncate max-w-[160px]">{c.industry}</TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-muted-foreground tabular-nums hidden md:table-cell">{c.employees}</TableCell>
                      <TableCell className="px-4 py-3.5 hidden md:table-cell">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 text-[10px] font-bold uppercase tracking-wider">
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-muted-foreground tabular-nums hidden lg:table-cell">
                        {new Date(c.founded).toLocaleDateString(locale === "da" ? "da-DK" : "en-US")}
                      </TableCell>
                      <TableCell className="px-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleSaveCompany(c, rawResults[idx] || {})}
                          disabled={isSaving}
                          className="rounded-full"
                          title={isSaved ? t.companyDetail.unsave : t.companyDetail.save}
                        >
                          <Heart className={cn(
                            "size-4 transition-all duration-200",
                            isSaved ? "text-red-500 fill-red-500" : "text-muted-foreground/30 hover:text-red-400"
                          )} />
                        </Button>
                      </TableCell>
                      <TableCell className="px-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full text-muted-foreground/30 hover:text-primary"
                          onClick={() => router.push(`/company/${c.cvr}`)}
                        >
                          <ExternalLink className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="px-5 sm:px-6 py-4 border-t border-border/40 flex justify-center">
              <Button
                variant="secondary"
                size="lg"
                className="rounded-xl gap-2"
                onClick={handleLoadMore}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                {isFetching ? s.loadingMore : s.loadMore}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ── Empty states ─────────────────────────────────────── */}
      {!hasSearched && (
        <Card className="py-20 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-5">
              <Search className="size-9 text-primary/30" />
            </div>
            <p className="text-foreground font-semibold text-lg mb-1.5">{s.title}</p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">{s.subtitle}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && hasSearched && results.length === 0 && !error && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <SearchX className="size-7 text-muted-foreground/40" />
            </div>
            <p className="text-foreground font-semibold mb-1">{locale === "da" ? "Ingen resultater" : "No results"}</p>
            <p className="text-muted-foreground text-sm">{s.noResults}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Save search dialog ───────────────────────────────── */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.savedSearches.namePrompt}</DialogTitle>
            <DialogDescription>{t.savedSearches.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={t.savedSearches.namePlaceholder}
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(getCurrentFilters()).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="text-xs font-medium">
                  <span className="text-muted-foreground mr-1">{key}:</span>{value}
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose render={<Button variant="ghost" onClick={() => setSaveSearchName("")} />}>
              {t.savedSearches.cancelButton}
            </DialogClose>
            <Button
              onClick={handleSaveSearch}
              disabled={!saveSearchName.trim() || saveSearchMutation.isPending}
            >
              {saveSearchMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {saveSearchMutation.isPending ? "..." : t.savedSearches.saveButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
