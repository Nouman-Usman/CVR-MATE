"use client";

import { useMemo, useState, useCallback } from "react";
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
  region: string;
  form: string;
}

const mockResults: Company[] = [
  { cvr: "41234567", name: "TechVentures ApS", city: "København", industry: "IT-programmering", industryCode: "62", status: "AKTIV", founded: "2025-11-01", employees: "23", region: "hovedstaden", form: "aps" },
  { cvr: "41345678", name: "Nordic Retail Group A/S", city: "Aarhus", industry: "Detailhandel", industryCode: "47", status: "AKTIV", founded: "2024-06-15", employees: "145", region: "midtjylland", form: "a/s" },
  { cvr: "41456789", name: "GreenEnergy Solutions IVS", city: "Odense", industry: "Engroshandel", industryCode: "46", status: "AKTIV", founded: "2025-03-20", employees: "8", region: "syddanmark", form: "ivs" },
  { cvr: "41567890", name: "Byg & Anlæg Danmark ApS", city: "Aalborg", industry: "Byggeri", industryCode: "41", status: "AKTIV", founded: "2023-09-10", employees: "67", region: "nordjylland", form: "aps" },
  { cvr: "41678901", name: "HealthFirst Klinik I/S", city: "Roskilde", industry: "Sundhedsvæsen", industryCode: "86", status: "AKTIV", founded: "2025-01-05", employees: "12", region: "sjaelland", form: "i/s" },
  { cvr: "41789012", name: "DataInsight Nordic ApS", city: "København", industry: "IT-programmering", industryCode: "62", status: "AKTIV", founded: "2025-08-22", employees: "35", region: "hovedstaden", form: "aps" },
  { cvr: "41890123", name: "Smag & Behag Restaurant", city: "Vejle", industry: "Restauranter", industryCode: "56", status: "AKTIV", founded: "2024-12-01", employees: "18", region: "syddanmark", form: "enkeltmandsvirksomhed" },
  { cvr: "41901234", name: "Nordic Consult Group A/S", city: "Herning", industry: "Virksomhedsrådgivning", industryCode: "70", status: "AKTIV", founded: "2022-05-14", employees: "92", region: "midtjylland", form: "a/s" },
  { cvr: "42012345", name: "EjendomsPartner DK ApS", city: "Helsingør", industry: "Ejendomshandel", industryCode: "68", status: "AKTIV", founded: "2024-03-08", employees: "5", region: "hovedstaden", form: "aps" },
  { cvr: "42123456", name: "Specialist Byg Syd ApS", city: "Kolding", industry: "Specialiseret byggeri", industryCode: "43", status: "AKTIV", founded: "2025-06-30", employees: "41", region: "syddanmark", form: "aps" },
  { cvr: "42234567", name: "MediCare Danmark A/S", city: "København", industry: "Sundhedsvæsen", industryCode: "86", status: "AKTIV", founded: "2023-11-18", employees: "210", region: "hovedstaden", form: "a/s" },
  { cvr: "42345678", name: "FoodTech Solutions ApS", city: "Aarhus", industry: "Engroshandel", industryCode: "46", status: "AKTIV", founded: "2025-02-14", employees: "16", region: "midtjylland", form: "aps" },
];

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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    if (!hasSearched) return [];
    return mockResults.filter((c) => {
      if (query) {
        const q = query.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.cvr.includes(q)) return false;
      }
      if (industryCode !== "all" && c.industryCode !== industryCode) return false;
      if (region !== "all" && c.region !== region) return false;
      if (companyForm !== "all" && c.form !== companyForm) return false;
      if (size !== "all") {
        const emp = parseInt(c.employees);
        if (isNaN(emp)) return false;
        const [lo, hi] = size === "100+" ? [100, Infinity] : size.split("-").map(Number);
        if (emp < lo || emp > hi) return false;
      }
      const emp = parseInt(c.employees);
      if (!isNaN(emp) && (emp < employeesMin || emp > employeesMax)) return false;
      return true;
    });
  }, [hasSearched, query, industryCode, region, companyForm, size, employeesMin, employeesMax]);

  const handleSearch = useCallback(() => {
    setHasSearched(true);
    setSelected(new Set());
  }, []);

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
            className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-lg">search</span>
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

      {/* Results */}
      {hasSearched && results.length > 0 && (
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

      {hasSearched && results.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100/60 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">apartment</span>
          <p className="text-slate-400 font-medium">{s.noResults}</p>
        </div>
      )}
    </DashboardLayout>
  );
}
