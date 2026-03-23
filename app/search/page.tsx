"use client";

import { useState, useCallback, useEffect, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { useSearchStore } from "@/lib/stores/search-store";
import { useSearchCompanies } from "@/lib/hooks/use-search";
import { useSavedCvrSet, useSaveCompany, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";
import { useSaveSearch } from "@/lib/hooks/use-saved-searches";

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
    employees: latestEmployment != null ? String(latestEmployment) : "–",
    form: comp.companyform?.description ?? "",
  };
}

const companyColors = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
];

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
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-600">{label}</label>
      <div className="relative h-6 flex items-center">
        <div className="absolute h-1 w-full bg-slate-200 rounded-full" />
        <div
          className="absolute h-1 bg-blue-600 rounded-full"
          style={{ left: `${leftPercent}%`, width: `${rightPercent - leftPercent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={minVal}
          onChange={(e) => onMinChange(Math.min(Number(e.target.value), maxVal - 1))}
          className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxVal}
          onChange={(e) => onMaxChange(Math.max(Number(e.target.value), minVal + 1))}
          className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10"
        />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 tabular-nums">
        <span>{min.toLocaleString()}</span>
        <span>{formatMax}</span>
      </div>
    </div>
  );
}

// Maps 2-digit industry group codes → Danish search terms for CVR API industry_primary_text.
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

  // ─── Zustand store (persisted across navigation) ───
  const store = useSearchStore();
  const {
    query, industryText, industryCode, companyForm, size,
    zipcode, region, foundedPeriod, revenueMin, revenueMax,
    profitMin, profitMax, employeesMin, employeesMax,
    showFilters, page, scrollY, selected, hasSearched,
    setFilter, setPage, setScrollY, setHasSearched, setShowFilters,
    toggleSelect, selectAll, clearSelected, resetAll,
  } = store;

  // ─── Build search params from current filters ───
  const searchAPIParams = useMemo(() => {
    if (!hasSearched) return null;
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
    const empRange = sizeToEmploymentRange(size);
    if (empRange.low) params.set("employment_interval_low", empRange.low);
    if (employeesMin > 0) params.set("employment_interval_low", String(employeesMin));
    return params.toString() ? params : null;
  }, [hasSearched, query, industryText, industryCode, companyForm, zipcode, region, foundedPeriod, size, employeesMin]);

  // ─── TanStack Query for search results (cached, survives navigation) ───
  const {
    data: searchData,
    isLoading,
    error: searchError,
    isFetching,
  } = useSearchCompanies(searchAPIParams, page, hasSearched);

  const rawResults = searchData?.results ?? [];
  const results = useMemo(() => rawResults.map(mapCvrCompany), [rawResults]);
  const totalResults = searchData?.total ?? 0;
  const hasMore = searchData?.hasMore ?? false;

  // ─── Saved companies (TanStack Query — shared with /saved page) ───
  const savedCvrs = useSavedCvrSet();
  const saveCompanyMutation = useSaveCompany();
  const unsaveCompanyMutation = useUnsaveCompany();

  // ─── Save search mutation ───
  const saveSearchMutation = useSaveSearch();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [localError, setLocalError] = useState("");

  // ─── Hydrate from URL params (e.g. saved search link) ───
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Scroll restoration ───
  useEffect(() => {
    if (hasSearched && results.length > 0 && scrollY > 0 && !isLoading) {
      window.scrollTo(0, scrollY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length]);

  useEffect(() => {
    return () => {
      setScrollY(window.scrollY);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handlers ───
  const handleSearch = useCallback(() => {
    setLocalError("");
    clearSelected();
    const hasFilter = query || industryText || industryCode !== "all" || companyForm !== "all" || zipcode || region !== "all" || foundedPeriod !== "all" || size !== "all" || employeesMin > 0;
    if (!hasFilter) {
      setLocalError(s.noFilter);
      return;
    }
    setPage(1);
    setHasSearched(true);
  }, [query, industryText, industryCode, companyForm, zipcode, region, foundedPeriod, size, employeesMin, s, setPage, setHasSearched, clearSelected]);

  const handleLoadMore = useCallback(() => {
    setPage(page + 1);
  }, [page, setPage]);

  const handleSaveCompany = useCallback((c: Company, rawResult: Record<string, unknown>) => {
    if (savedCvrs.has(c.cvr)) {
      unsaveCompanyMutation.mutate(c.cvr);
    } else {
      saveCompanyMutation.mutate({ vat: c.cvr, name: c.name, rawData: rawResult });
    }
  }, [savedCvrs, saveCompanyMutation, unsaveCompanyMutation]);

  const clearFilters = useCallback(() => {
    resetAll();
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

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)]">
          {s.title}
        </h1>
        <p className="text-sm text-slate-400 mt-1">{s.subtitle}</p>
      </div>

      {/* Search card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 p-4 sm:p-6 mb-6">
        {/* Search bar */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <span className="material-symbols-outlined text-slate-400 text-xl absolute left-4 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
              placeholder={s.searchPlaceholder}
              value={query}
              onChange={(e) => setFilter("query", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading || isFetching}
            className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {(isLoading || isFetching) ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-lg">search</span>
            )}
            {s.searchButton}
          </button>
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">
            {showFilters ? "expand_less" : "expand_more"}
          </span>
          {s.filters.title}
        </button>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">{s.filters.industry}</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  placeholder={s.filters.industryPlaceholder}
                  value={industryText}
                  onChange={(e) => setFilter("industryText", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">{s.filters.industryCode}</label>
                <select
                  value={industryCode}
                  onChange={(e) => setFilter("industryCode", e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  <option value="all">{s.filters.industryCodePlaceholder}</option>
                  {s.industries.filter((i) => i.code !== "all").map((ind) => (
                    <option key={ind.code} value={ind.code}>{ind.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">{s.filters.companyForm}</label>
                <select
                  value={companyForm}
                  onChange={(e) => setFilter("companyForm", e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  <option value="all">{s.filters.companyFormPlaceholder}</option>
                  {s.companyForms.filter((f) => f.code !== "all").map((f) => (
                    <option key={f.code} value={f.code}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">{s.filters.size}</label>
                <select
                  value={size}
                  onChange={(e) => setFilter("size", e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  <option value="all">{s.filters.sizePlaceholder}</option>
                  {s.sizes.filter((sz) => sz.code !== "all").map((sz) => (
                    <option key={sz.code} value={sz.code}>{sz.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">{s.filters.zipcode}</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  placeholder={s.filters.zipcodePlaceholder}
                  value={zipcode}
                  onChange={(e) => setFilter("zipcode", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">{s.filters.region}</label>
                <select
                  value={region}
                  onChange={(e) => setFilter("region", e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  <option value="all">{s.filters.regionPlaceholder}</option>
                  {s.regions.filter((r) => r.code !== "all").map((reg) => (
                    <option key={reg.code} value={reg.code}>{reg.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">{s.filters.foundedDate}</label>
                <select
                  value={foundedPeriod}
                  onChange={(e) => setFilter("foundedPeriod", e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  {foundedOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Segmentation */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 mb-4">{s.filters.segmentation}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <RangeSlider label={s.filters.revenue} min={0} max={1000} minVal={revenueMin} maxVal={revenueMax} onMinChange={(v) => setFilter("revenueMin", v)} onMaxChange={(v) => setFilter("revenueMax", v)} formatMax="1 bn+" />
                <RangeSlider label={s.filters.grossProfit} min={0} max={1000} minVal={profitMin} maxVal={profitMax} onMinChange={(v) => setFilter("profitMin", v)} onMaxChange={(v) => setFilter("profitMax", v)} formatMax="1 bn+" />
                <RangeSlider label={s.filters.employees} min={0} max={5000} minVal={employeesMin} maxVal={employeesMax} onMinChange={(v) => setFilter("employeesMin", v)} onMaxChange={(v) => setFilter("employeesMax", v)} formatMax="5,000+" />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={clearFilters} className="text-xs font-medium text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
                {s.filters.clearFilters}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500 text-lg">error</span>
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Selected actions */}
      {selected.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-blue-700">{selected.length} {s.selected}</p>
          <button className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-full hover:bg-blue-700 transition-colors">
            <span className="material-symbols-outlined text-lg">download</span>
            {s.export}
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-400 font-medium">{s.searchButton}...</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && hasSearched && results.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100/60 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              <span className="font-bold text-slate-900">{results.length}</span>
              {totalResults > results.length && (
                <span className="text-slate-400"> / {totalResults}</span>
              )}{" "}
              {s.results}
            </p>
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">bookmark</span>
              {s.saveSearch}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 sm:px-6 py-3 w-10">
                    <input type="checkbox" checked={selectedSet.size === results.length && results.length > 0} onChange={toggleAll} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" />
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.table.company}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.table.cvr}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">{s.table.city}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">{s.table.industry}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">{s.table.employees}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">{s.table.status}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">{s.table.founded}</th>
                  <th className="w-10 px-2 py-3" />
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {results.map((c, idx) => {
                  const color = companyColors[idx % companyColors.length];
                  const initials = c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  const isSaved = savedCvrs.has(c.cvr);
                  const isSaving = savingCvr === c.cvr;
                  return (
                    <tr key={c.cvr} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => router.push(`/company/${c.cvr}`)}>
                      <td className="px-4 sm:px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedSet.has(c.cvr)} onChange={() => toggleSelect(c.cvr)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                            <span className={`text-xs font-bold ${color.text}`}>{initials}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600 transition-colors">{c.name}</p>
                            <p className="text-[10px] text-slate-400 md:hidden">{c.city} · {c.employees}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums">{c.cvr}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 hidden md:table-cell">{c.city}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 hidden lg:table-cell truncate max-w-[160px]">{c.industry}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums hidden md:table-cell">{c.employees}</td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">{c.status}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 tabular-nums hidden lg:table-cell">
                        {new Date(c.founded).toLocaleDateString(locale === "da" ? "da-DK" : "en-US")}
                      </td>
                      <td className="px-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSaveCompany(c, rawResults[idx] || {})}
                          disabled={isSaving}
                          className="group p-1 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
                          title={isSaved ? t.companyDetail.unsave : t.companyDetail.save}
                        >
                          <span
                            className={`material-symbols-outlined text-lg transition-colors ${isSaved ? "text-red-500" : "text-slate-300 group-hover:text-red-400"}`}
                            style={isSaved ? { fontVariationSettings: "'FILL' 1" } : undefined}
                          >
                            favorite
                          </span>
                        </button>
                      </td>
                      <td className="px-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <span className="material-symbols-outlined text-slate-300 hover:text-blue-600 text-lg transition-colors cursor-pointer">open_in_new</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={isFetching}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isFetching ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-lg">expand_more</span>
                )}
                {isFetching ? s.loadingMore : s.loadMore}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty states */}
      {!hasSearched && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-20 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 block">manage_search</span>
          <p className="text-slate-400 font-medium text-lg mb-1">{s.title}</p>
          <p className="text-slate-300 text-sm">{s.subtitle}</p>
        </div>
      )}

      {!isLoading && hasSearched && results.length === 0 && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">apartment</span>
          <p className="text-slate-400 font-medium">{s.noResults}</p>
        </div>
      )}

      {/* Save search modal */}
      {showSaveModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowSaveModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{t.savedSearches.namePrompt}</h3>
              <p className="text-sm text-slate-400 mb-4">{t.savedSearches.subtitle}</p>
              <input
                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none mb-4"
                placeholder={t.savedSearches.namePlaceholder}
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 mb-5">
                {Object.entries(getCurrentFilters()).map(([key, value]) => (
                  <span key={key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100">
                    <span className="text-slate-400">{key}:</span>{value}
                  </span>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowSaveModal(false); setSaveSearchName(""); }} className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer">
                  {t.savedSearches.cancelButton}
                </button>
                <button
                  onClick={handleSaveSearch}
                  disabled={!saveSearchName.trim() || saveSearchMutation.isPending}
                  className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saveSearchMutation.isPending ? "..." : t.savedSearches.saveButton}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
