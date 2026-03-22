"use client";

import { useState, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";

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
    employment?: { months?: { amount?: number | null }[] }[];
  };

  const latestEmployment = comp.employment?.[0]?.months?.[0]?.amount;

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

const companyFormCodeMap: Record<string, string> = {
  aps: "80",
  "a/s": "60",
  ivs: "140",
  "i/s": "30",
  enkeltmandsvirksomhed: "10",
};

function foundedToDate(period: string): string | null {
  if (period === "all") return null;
  const now = new Date();
  const map: Record<string, number> = { last30: 30, last90: 90, last365: 365, last3y: 1095 };
  const days = map[period];
  if (!days) return null;
  const d = new Date(now.getTime() - days * 86400000);
  return d.toISOString().split("T")[0];
}

function sizeToEmploymentRange(s: string): { low?: string; high?: string } {
  if (s === "all") return {};
  if (s === "100+") return { low: "100" };
  const [lo, hi] = s.split("-");
  return { low: lo, high: hi };
}

export default function SearchPage() {
  const { t, locale } = useLanguage();
  const s = t.search;

  const [query, setQuery] = useState("");
  const [industryText, setIndustryText] = useState("");
  const [industryCode, setIndustryCode] = useState("all");
  const [companyForm, setCompanyForm] = useState("all");
  const [size, setSize] = useState("all");
  const [zipcode, setZipcode] = useState("");
  const [region, setRegion] = useState("all");
  const [foundedPeriod, setFoundedPeriod] = useState("all");
  const [revenueMin, setRevenueMin] = useState(0);
  const [revenueMax, setRevenueMax] = useState(1000);
  const [profitMin, setProfitMin] = useState(0);
  const [profitMax, setProfitMax] = useState(1000);
  const [employeesMin, setEmployeesMin] = useState(0);
  const [employeesMax, setEmployeesMax] = useState(5000);

  const [showFilters, setShowFilters] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    setError("");
    setSelected(new Set());

    const params = new URLSearchParams();

    if (query) params.set("name", query);
    if (industryText) params.set("industry_text", industryText);
    if (industryCode !== "all") params.set("industry_code", industryCode);
    if (companyForm !== "all") {
      const code = companyFormCodeMap[companyForm];
      if (code) params.set("companyform_code", code);
    }
    if (zipcode) params.set("zipcode", zipcode);
    if (region !== "all") params.set("municipality", region);

    const lifeStart = foundedToDate(foundedPeriod);
    if (lifeStart) params.set("life_start", lifeStart);

    const empRange = sizeToEmploymentRange(size);
    if (empRange.low) params.set("employment_interval_low", empRange.low);

    if (employeesMin > 0) params.set("employment_interval_low", String(employeesMin));

    // Check if there's at least one real filter
    if (params.toString() === "") {
      setError(s.noFilter);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/cvr/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || s.searchError);
        setResults([]);
        return;
      }

      const mapped = (data.results || []).map(mapCvrCompany);
      setResults(mapped);
    } catch {
      setError(s.searchError);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, industryText, industryCode, companyForm, zipcode, region, foundedPeriod, size, employeesMin, employeesMax, s]);

  const clearFilters = () => {
    setQuery("");
    setIndustryText("");
    setIndustryCode("all");
    setCompanyForm("all");
    setSize("all");
    setZipcode("");
    setRegion("all");
    setFoundedPeriod("all");
    setRevenueMin(0);
    setRevenueMax(1000);
    setProfitMin(0);
    setProfitMax(1000);
    setEmployeesMin(0);
    setEmployeesMax(5000);
    setHasSearched(false);
    setSelected(new Set());
    setResults([]);
    setError("");
  };

  const toggleSelect = (cvr: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cvr)) next.delete(cvr);
      else next.add(cvr);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((r) => r.cvr)));
  };

  const foundedOptions = [
    { code: "all", label: locale === "da" ? "Vælg periode" : "Select period" },
    { code: "last30", label: locale === "da" ? "Sidste 30 dage" : "Last 30 days" },
    { code: "last90", label: locale === "da" ? "Sidste 90 dage" : "Last 90 days" },
    { code: "last365", label: locale === "da" ? "Sidste år" : "Last year" },
    { code: "last3y", label: locale === "da" ? "Sidste 3 år" : "Last 3 years" },
  ];

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
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
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
            {/* Row 1: Industry text, Industry code, Company form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">
                  {s.filters.industry}
                </label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  placeholder={s.filters.industryPlaceholder}
                  value={industryText}
                  onChange={(e) => setIndustryText(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">
                  {s.filters.industryCode}
                </label>
                <select
                  value={industryCode}
                  onChange={(e) => setIndustryCode(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  <option value="all">{s.filters.industryCodePlaceholder}</option>
                  {s.industries
                    .filter((i) => i.code !== "all")
                    .map((ind) => (
                      <option key={ind.code} value={ind.code}>
                        {ind.label}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">
                  {s.filters.companyForm}
                </label>
                <select
                  value={companyForm}
                  onChange={(e) => setCompanyForm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  <option value="all">{s.filters.companyFormPlaceholder}</option>
                  {s.companyForms
                    .filter((f) => f.code !== "all")
                    .map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Row 2: Company size, Zipcode, Region */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">
                  {s.filters.size}
                </label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  <option value="all">{s.filters.sizePlaceholder}</option>
                  {s.sizes
                    .filter((sz) => sz.code !== "all")
                    .map((sz) => (
                      <option key={sz.code} value={sz.code}>
                        {sz.label}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">
                  {s.filters.zipcode}
                </label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  placeholder={s.filters.zipcodePlaceholder}
                  value={zipcode}
                  onChange={(e) => setZipcode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">
                  {s.filters.region}
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  <option value="all">{s.filters.regionPlaceholder}</option>
                  {s.regions
                    .filter((r) => r.code !== "all")
                    .map((reg) => (
                      <option key={reg.code} value={reg.code}>
                        {reg.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Row 3: Founded date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">
                  {s.filters.foundedDate}
                </label>
                <select
                  value={foundedPeriod}
                  onChange={(e) => setFoundedPeriod(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                >
                  {foundedOptions.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Segmentation */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 mb-4">
                {s.filters.segmentation}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <RangeSlider
                  label={s.filters.revenue}
                  min={0}
                  max={1000}
                  minVal={revenueMin}
                  maxVal={revenueMax}
                  onMinChange={setRevenueMin}
                  onMaxChange={setRevenueMax}
                  formatMax="1 bn+"
                />
                <RangeSlider
                  label={s.filters.grossProfit}
                  min={0}
                  max={1000}
                  minVal={profitMin}
                  maxVal={profitMax}
                  onMinChange={setProfitMin}
                  onMaxChange={setProfitMax}
                  formatMax="1 bn+"
                />
                <RangeSlider
                  label={s.filters.employees}
                  min={0}
                  max={5000}
                  minVal={employeesMin}
                  maxVal={employeesMax}
                  onMinChange={setEmployeesMin}
                  onMaxChange={setEmployeesMax}
                  formatMax="5,000+"
                />
              </div>
            </div>

            {/* Clear */}
            <div className="flex justify-end mt-4">
              <button
                onClick={clearFilters}
                className="text-xs font-medium text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                {s.filters.clearFilters}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500 text-lg">error</span>
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Selected actions bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-blue-700">
            {selected.size} {s.selected}
          </p>
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
              <span className="font-bold text-slate-900">{results.length}</span>{" "}
              {s.results}
            </p>
            {hasSearched && results.length > 0 && (
              <button className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700">
                <span className="material-symbols-outlined text-lg">bookmark</span>
                {s.saveSearch}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 sm:px-6 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === results.length && results.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                    />
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.table.company}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.table.cvr}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">{s.table.city}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">{s.table.industry}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">{s.table.employees}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">{s.table.status}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">{s.table.founded}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {results.map((c, idx) => {
                  const color = companyColors[idx % companyColors.length];
                  const initials = c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <tr key={c.cvr} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 sm:px-6 py-3.5">
                        <input
                          type="checkbox"
                          checked={selected.has(c.cvr)}
                          onChange={() => toggleSelect(c.cvr)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center shrink-0`}>
                            <span className={`text-xs font-bold ${color.text}`}>{initials}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    </DashboardLayout>
  );
}
