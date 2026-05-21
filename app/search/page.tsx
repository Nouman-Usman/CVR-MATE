"use client";

import { useState, useCallback, useEffect, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { VideoTrigger } from "@/components/videos/VideoTrigger";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import { useSearchStore, type SearchFiltersState } from "@/lib/stores/search-store";
import {
  buildSearchParamsFromState,
  hydrateSearchFiltersFromParams,
  mergeSearchFilters,
  serializeSearchFilters,
} from "@/lib/search-filters";
import { useSearchCompanies } from "@/lib/hooks/use-search";
import { useSavedCvrSet, useSaveCompany, useUnsaveCompany } from "@/lib/hooks/use-saved-companies";
import { useSaveSearch } from "@/lib/hooks/use-saved-searches";
import { useSubscription } from "@/lib/hooks/use-subscription";
import { useUpgradePrompt } from "@/lib/hooks/use-upgrade-prompt";

import { companyColors } from "@/lib/constants/colors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Search,
  ChevronDown,
  Heart,
  Loader2,
  SearchX,
  Bookmark,
  Download,
  SlidersHorizontal,
  ChevronRight,
  RotateCcw,
  X,
  HelpCircle,
  Building2,
  MapPin,
  Users,
  TrendingUp,
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
  isDissolved: boolean;
}

type UpgradeError = Error & { upgrade?: boolean };

function normalizeStatusText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function mapCvrCompany(c: Record<string, unknown>): Company {
  const comp = c as {
    vat?: number;
    life?: { name?: string; start?: string; end?: string };
    address?: { cityname?: string; zipcode?: number };
    industry?: { primary?: { text?: string; code?: number } };
    companystatus?: { text?: string };
    companyform?: { description?: string };
    employment?: { months?: { amount?: number | null }[] };
    _employeeCount?: number | null;
  };

  const latestEmployment = comp._employeeCount ?? comp.employment?.months?.[0]?.amount;
  const statusText = normalizeStatusText(comp.companystatus?.text);
  const isDissolved = !!comp.life?.end || ["oph\u00f8rt", "opl\u00f8st", "dissolved", "closed"].includes(statusText);

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
    isDissolved,
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
  helpInfo,
  helpLabels,
}: {
  label: string;
  min: number;
  max: number;
  minVal: number;
  maxVal: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
  formatMax: string;
  helpInfo?: FilterHelpInfo;
  helpLabels?: {
    whyLabel: string;
    howLabel: string;
    openLabel: string;
    closeLabel: string;
  };
}) {
  const leftPercent = ((minVal - min) / (max - min)) * 100;
  const rightPercent = ((maxVal - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
          {helpInfo && helpLabels && (
            <FilterHelpButton
              info={helpInfo}
              whyLabel={helpLabels.whyLabel}
              howLabel={helpLabels.howLabel}
              openLabel={helpLabels.openLabel}
              closeLabel={helpLabels.closeLabel}
            />
          )}
        </div>
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

// ── Select wrapper (styled native select) ───────────────────────────

function FilterSelect({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:ring-2 focus:ring-ring/20 focus:border-ring outline-none appearance-none transition-colors disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground/70"
    >
      {children}
    </select>
  );
}

// ── Filter field wrapper — consistent label/input/help rhythm ───────

type FilterHelpInfo = {
  title: string;
  why: string;
  how: string;
};

function FilterHelpButton({
  info,
  whyLabel,
  howLabel,
  openLabel,
  closeLabel,
}: {
  info: FilterHelpInfo;
  whyLabel: string;
  howLabel: string;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground/55 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        aria-label={`${openLabel}: ${info.title}`}
      >
        <HelpCircle className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{info.title}</DialogTitle>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {whyLabel}
            </p>
            <DialogDescription>
              {info.why}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {howLabel}
            </p>
            <p className="text-sm leading-6 text-foreground/80">{info.how}</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose render={<Button variant="outline" />}>
              {closeLabel}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterField({
  label,
  help,
  helpInfo,
  helpLabels,
  children,
}: {
  label: string;
  help?: string;
  helpInfo?: FilterHelpInfo;
  helpLabels?: {
    whyLabel: string;
    howLabel: string;
    openLabel: string;
    closeLabel: string;
  };
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-[11px] font-semibold text-foreground/70 tracking-wide">{label}</Label>
        {helpInfo && helpLabels && (
          <FilterHelpButton
            info={helpInfo}
            whyLabel={helpLabels.whyLabel}
            howLabel={helpLabels.howLabel}
            openLabel={helpLabels.openLabel}
            closeLabel={helpLabels.closeLabel}
          />
        )}
      </div>
      {children}
      {help && <p className="text-[10.5px] leading-tight text-muted-foreground/60">{help}</p>}
    </div>
  );
}

// ── Section header — editorial divider with optional icon ───────────

function FilterSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="py-5 first:pt-0 border-t border-border/30 first:border-t-0">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="size-3.5 text-muted-foreground/60" />}
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

// ── Active filter chips with × removal ──────────────────────────────

type ChipDescriptor = {
  key: string;
  label: string;
  value: string;
  clear: () => void;
};

function ActiveFilterChips({
  chips,
  emptyLabel,
}: {
  chips: ChipDescriptor[];
  emptyLabel: string;
}) {
  if (chips.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/50 italic">{emptyLabel}</p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-md bg-foreground/[0.04] text-[11px] font-medium text-foreground border border-border/40 hover:border-border transition-colors"
        >
          <span className="text-muted-foreground/70">{chip.label}</span>
          <span className="tabular-nums">{chip.value}</span>
          <button
            type="button"
            onClick={chip.clear}
            className="ml-0.5 inline-flex items-center justify-center size-4 rounded-sm hover:bg-foreground/[0.06] text-muted-foreground/60 hover:text-foreground transition-colors"
            aria-label="Remove filter"
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        </span>
      ))}
    </div>
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
  const filterHelp = s.filters.help.fields;
  const filterHelpLabels = {
    whyLabel: s.filters.help.whyLabel,
    howLabel: s.filters.help.howLabel,
    openLabel: s.filters.help.openLabel,
    closeLabel: s.filters.help.closeLabel,
  };

  const { data: sub } = useSubscription();
  const { triggerUpgrade } = useUpgradePrompt();

  const store = useSearchStore();
  const {
    query, industryText, industryCode, industrySecondaryText, industrySecondaryCode,
    street, streetcode, numberFrom, letterFrom, zipcode, region, city, municipality,
    contactPhone, contactEmail, contactWww,
    size, employmentAmount, foundedPeriod,
    companyformCode, companyformDescription, companyformHolding,
    companystatusCode, statusBankrupt,
    capitalCapital, capitalCurrency, capitalIpo, infoEanId, infoLeiId,
    revenueMin, revenueMax, profitMin, profitMax, employeesMin, employeesMax,
    skipMarketingOptOut,
    showFilters, scrollY, selected, hasSearched,
    setFilter, setScrollY, setHasSearched, setShowFilters,
    toggleSelect, clearSelected, resetAll,
  } = store;

  const [committedParams, setCommittedParams] = useState<URLSearchParams | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentFilters = useMemo<SearchFiltersState>(() => ({
    query,
    industryText,
    industryCode,
    industrySecondaryText,
    industrySecondaryCode,
    street,
    streetcode,
    numberFrom,
    letterFrom,
    zipcode,
    region,
    city,
    municipality,
    contactPhone,
    contactEmail,
    contactWww,
    size,
    employmentAmount,
    companyformCode,
    companyformDescription,
    companyformHolding,
    companystatusCode,
    statusBankrupt,
    capitalCapital,
    capitalCurrency,
    capitalIpo,
    infoEanId,
    infoLeiId,
    foundedPeriod,
    revenueMin,
    revenueMax,
    profitMin,
    profitMax,
    employeesMin,
    employeesMax,
    skipMarketingOptOut,
  }), [query, industryText, industryCode, industrySecondaryText, industrySecondaryCode, street, streetcode, numberFrom, letterFrom, zipcode, region, city, municipality, contactPhone, contactEmail, contactWww, size, employmentAmount, companyformCode, companyformDescription, companyformHolding, companystatusCode, statusBankrupt, capitalCapital, capitalCurrency, capitalIpo, infoEanId, infoLeiId, foundedPeriod, revenueMin, revenueMax, profitMin, profitMax, employeesMin, employeesMax, skipMarketingOptOut]);

  const buildSearchParams = useCallback(() => {
    return buildSearchParamsFromState(currentFilters);
  }, [currentFilters]);

  const {
    data: searchData,
    isLoading,
    error: searchError,
    isFetching,
  } = useSearchCompanies(committedParams, hasSearched);

  // Map raw results to typed Company objects
  const rawResults = useMemo(() => searchData?.results ?? [], [searchData?.results]);
  const results = useMemo(() => rawResults.map(mapCvrCompany), [rawResults]);

  // Build a map of CVR → raw data for saving companies
  const rawDataMap = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    rawResults.forEach((r, i) => {
      if (results[i]) m.set(results[i].cvr, r);
    });
    return m;
  }, [rawResults, results]);

  const savedCvrs = useSavedCvrSet();
  const saveCompanyMutation = useSaveCompany();
  const unsaveCompanyMutation = useUnsaveCompany();

  const saveSearchMutation = useSaveSearch();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const { filters, hasParams } = hydrateSearchFiltersFromParams(urlParams);
    const hydratedFilters = mergeSearchFilters(filters);
    for (const [key, value] of Object.entries(hydratedFilters)) {
      setFilter(key as keyof SearchFiltersState, value as never);
    }
    if (hasParams) {
      setHasSearched(true);
      setCommittedParams(buildSearchParamsFromState(hydratedFilters));
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

  useEffect(() => {
    if (searchError) {
      if ((searchError as UpgradeError).upgrade) {
        triggerUpgrade("company_search");
      } else {
        toast.error(searchError.message || s.searchError);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchError]);

  const handleSearch = useCallback(() => {
    const searchUsage = sub?.usage?.companySearches;
    if (searchUsage && searchUsage.limit !== -1 && searchUsage.used >= searchUsage.limit) {
      triggerUpgrade("company_search");
      return;
    }

    clearSelected();
    const params = buildSearchParams();
    if (!params) {
      toast.error(s.noFilter);
      return;
    }
    setHasSearched(true);
    setCommittedParams(params);
  }, [buildSearchParams, s, setHasSearched, setCommittedParams, clearSelected, sub, triggerUpgrade]);

  const handleSaveCompany = useCallback((c: Company, rawResult: Record<string, unknown>) => {
    if (savedCvrs.has(c.cvr)) {
      unsaveCompanyMutation.mutate(c.cvr, {
        onSuccess: () => toast.success(locale === "da" ? "Fjernet fra gemte" : "Removed from saved"),
        onError: () => toast.error(locale === "da" ? "Kunne ikke fjerne" : "Failed to remove"),
      });
    } else {
      if (sub && sub.limits.savedCompanies !== -1 && savedCvrs.size >= sub.limits.savedCompanies) {
        triggerUpgrade("saved_company");
        return;
      }
      saveCompanyMutation.mutate({ vat: c.cvr, name: c.name, rawData: rawResult }, {
        onSuccess: () => toast.success(locale === "da" ? `${c.name} gemt` : `${c.name} saved`),
        onError: (err: UpgradeError) => {
          if (err.upgrade) {
            triggerUpgrade("saved_company");
          } else {
            toast.error(locale === "da" ? "Kunne ikke gemme" : "Failed to save");
          }
        },
      });
    }
  }, [savedCvrs, saveCompanyMutation, unsaveCompanyMutation, locale, sub, triggerUpgrade]);

  const clearFilters = useCallback(() => {
    resetAll();
    setCommittedParams(null);
  }, [resetAll]);

  const getCurrentFilters = useCallback((): Record<string, string> => {
    return serializeSearchFilters(currentFilters);
  }, [currentFilters]);

  const handleSaveSearch = useCallback(async () => {
    if (!saveSearchName.trim()) return;
    saveSearchMutation.mutate(
      { name: saveSearchName.trim(), filters: getCurrentFilters() },
      {
        onSuccess: () => {
          setShowSaveModal(false);
          setSaveSearchName("");
          toast.success(locale === "da" ? "Søgning gemt" : "Search saved");
        },
        onError: () => toast.error(locale === "da" ? "Kunne ikke gemme søgning" : "Failed to save search"),
      }
    );
  }, [saveSearchName, getCurrentFilters, saveSearchMutation, locale]);

  const foundedOptions = [
    { code: "all", label: locale === "da" ? "Vælg periode" : "Select period" },
    { code: "last30", label: locale === "da" ? "Sidste 30 dage" : "Last 30 days" },
    { code: "last90", label: locale === "da" ? "Sidste 90 dage" : "Last 90 days" },
    { code: "last365", label: locale === "da" ? "Sidste år" : "Last year" },
    { code: "last3y", label: locale === "da" ? "Sidste 3 år" : "Last 3 years" },
  ];

  const booleanOptions = [
    { code: "all", label: locale === "da" ? "Alle" : "Any" },
    { code: "true", label: locale === "da" ? "Ja" : "Yes" },
    { code: "false", label: locale === "da" ? "Nej" : "No" },
  ];

  const statusOptions = [
    { code: "20", label: locale === "da" ? "20 - I drift" : "20 - Active" },
    { code: "3", label: "3 - OPLØST" },
    { code: "4", label: "4 - OPLØST EFTER ERKLÆRING" },
    { code: "5", label: "5 - OPLØST EFTER FRIVILLIG LIKVIDATION" },
    { code: "6", label: "6 - OPLØST EFTER FUSION" },
    { code: "7", label: "7 - OPLØST EFTER KONKURS" },
    { code: "8", label: "8 - OPLØST EFTER SPALTNING" },
    { code: "10", label: "10 - SLETTET" },
    { code: "11", label: "11 - TVANGSOPLØST" },
    { code: "12", label: "12 - UDEN RETSVIRKNING" },
    { code: "13", label: "13 - UNDER FRIVILLIG LIKVIDATION" },
    { code: "14", label: "14 - UNDER KONKURS" },
    { code: "15", label: "15 - UNDER REASSUMERING" },
    { code: "17", label: "17 - UNDER REKONSTRUKTION" },
    { code: "18", label: "18 - UNDER TVANGSOPLØSNING" },
    { code: "19", label: "19 - OPHØRT" },
    { code: "21", label: "21 - OPLØST EFTER GRÆNSEOVERSKRIDENDE HJEMSTEDSFLYTNING" },
    { code: "23", label: "23 - OPLØST EFTER GRÆNSEOVERSKRIDENDE FUSION" },
    { code: "24", label: "24 - LUKKET" },
  ];

  const companyFormOptions = [
    { code: "10", description: "Enkeltmandsvirksomhed", label: locale === "da" ? "10 - Enkeltmandsvirksomhed" : "10 - Sole proprietorship" },
    { code: "15", description: "Interessentskab", label: locale === "da" ? "15 - Interessentskab" : "15 - Partnership" },
    { code: "30", description: "Aktieselskab", label: locale === "da" ? "30 - Aktieselskab (A/S)" : "30 - Public limited company (A/S)" },
    { code: "40", description: "Anpartsselskab", label: locale === "da" ? "40 - Anpartsselskab (ApS)" : "40 - Private limited company (ApS)" },
    { code: "45", description: "Iværksætterselskab", label: locale === "da" ? "45 - Iværksætterselskab (IVS)" : "45 - Entrepreneurial company (IVS)" },
    { code: "60", description: "Forening", label: locale === "da" ? "60 - Forening" : "60 - Association" },
    { code: "80", description: "Fonden eller andre selvejende institutioner", label: locale === "da" ? "80 - Fond / selvejende institution" : "80 - Foundation / self-governing institution" },
    { code: "90", description: "Anden udenlandsk virksomhed", label: locale === "da" ? "90 - Anden udenlandsk virksomhed" : "90 - Other foreign company" },
  ];

  const currencyOptions = ["DKK", "EUR", "USD", "GBP", "SEK", "NOK"];

  const regionHelperCopy: Record<string, string> = {
    hovedstaden: locale === "da"
      ? "Omfatter København, Frederiksberg, Gentofte og omegn."
      : "Includes Copenhagen, Frederiksberg, Gentofte, and nearby areas.",
    midtjylland: locale === "da"
      ? "Omfatter Aarhus, Viborg, Herning og hele det centrale Jylland."
      : "Includes Aarhus, Viborg, Herning, and central Jutland.",
    syddanmark: locale === "da"
      ? "Omfatter Vejle, Kolding, Odense, Esbjerg og Sønderborg."
      : "Includes Vejle, Kolding, Odense, Esbjerg, and Sønderborg.",
    nordjylland: locale === "da"
      ? "Omfatter Aalborg, Hjørring, Frederikshavn og Nordjylland."
      : "Includes Aalborg, Hjørring, Frederikshavn, and Northern Jutland.",
    sjaelland: locale === "da"
      ? "Omfatter Roskilde, Køge, Næstved, Faxe og resten af Sjælland."
      : "Includes Roskilde, Køge, Næstved, Faxe, and the rest of Zealand.",
  };

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const savingCvr = saveCompanyMutation.isPending ? (saveCompanyMutation.variables?.vat ?? null) : (unsaveCompanyMutation.isPending ? unsaveCompanyMutation.variables ?? null : null);

  const activeChips = useMemo<ChipDescriptor[]>(() => {
    const list: ChipDescriptor[] = [];
    const labels = s.filters;
    const push = (key: string, label: string, value: string, clear: () => void) => {
      if (value) list.push({ key, label, value, clear });
    };

    if (query) push("query", locale === "da" ? "Navn" : "Name", query, () => setFilter("query", ""));
    if (industryText) push("industryText", labels.industry, industryText, () => setFilter("industryText", ""));
    if (industryCode !== "all") {
      const ind = s.industries.find((i) => i.code === industryCode);
      push("industryCode", labels.industryCode, ind?.label ?? industryCode, () => setFilter("industryCode", "all"));
    }
    if (industrySecondaryText) push("industrySecondaryText", labels.industrySecondaryText, industrySecondaryText, () => setFilter("industrySecondaryText", ""));
    if (industrySecondaryCode) push("industrySecondaryCode", labels.industrySecondaryCode, industrySecondaryCode, () => setFilter("industrySecondaryCode", ""));
    if (zipcode) push("zipcode", labels.zipcode, zipcode, () => setFilter("zipcode", ""));
    if (!zipcode && region !== "all") {
      const reg = s.regions.find((r) => r.code === region);
      push("region", labels.region, reg?.label ?? region, () => setFilter("region", "all"));
    }
    if (city) push("city", labels.city, city, () => setFilter("city", ""));
    if (municipality) push("municipality", labels.municipality, municipality, () => setFilter("municipality", ""));
    if (street) push("street", labels.street, street, () => setFilter("street", ""));
    if (streetcode) push("streetcode", labels.streetcode, streetcode, () => setFilter("streetcode", ""));
    if (numberFrom) push("numberFrom", labels.numberFrom, numberFrom + (letterFrom || ""), () => { setFilter("numberFrom", ""); setFilter("letterFrom", ""); });
    if (contactPhone) push("contactPhone", labels.contactPhone, contactPhone, () => setFilter("contactPhone", ""));
    if (contactEmail) push("contactEmail", labels.contactEmail, contactEmail, () => setFilter("contactEmail", ""));
    if (contactWww) push("contactWww", labels.contactWww, contactWww, () => setFilter("contactWww", ""));
    if (size !== "all") {
      const sz = s.sizes.find((x) => x.code === size);
      push("size", labels.size, sz?.label ?? size, () => setFilter("size", "all"));
    }
    if (employmentAmount) push("employmentAmount", labels.employmentAmount, employmentAmount, () => setFilter("employmentAmount", ""));
    if (companyformCode) {
      const form = companyFormOptions.find((o) => o.code === companyformCode);
      push("companyformCode", labels.companyformCode, form?.label ?? companyformCode, () => {
        setFilter("companyformCode", "");
        setFilter("companyformDescription", "");
      });
    } else if (companyformDescription) {
      push("companyformDescription", labels.companyformDescription, companyformDescription, () => setFilter("companyformDescription", ""));
    }
    if (companyformHolding !== "all") {
      const opt = booleanOptions.find((o) => o.code === companyformHolding);
      push("companyformHolding", labels.companyformHolding, opt?.label ?? companyformHolding, () => setFilter("companyformHolding", "all"));
    }
    if (companystatusCode) {
      const opt = statusOptions.find((o) => o.code === companystatusCode);
      push("companystatusCode", labels.companystatusCode, opt?.label ?? companystatusCode, () => setFilter("companystatusCode", ""));
    }
    if (statusBankrupt !== "all") {
      const opt = booleanOptions.find((o) => o.code === statusBankrupt);
      push("statusBankrupt", labels.statusBankrupt, opt?.label ?? statusBankrupt, () => setFilter("statusBankrupt", "all"));
    }
    if (capitalCapital) push("capitalCapital", labels.capitalCapital, capitalCapital, () => setFilter("capitalCapital", ""));
    if (capitalCurrency) push("capitalCurrency", labels.capitalCurrency, capitalCurrency, () => setFilter("capitalCurrency", ""));
    if (capitalIpo !== "all") {
      const opt = booleanOptions.find((o) => o.code === capitalIpo);
      push("capitalIpo", labels.capitalIpo, opt?.label ?? capitalIpo, () => setFilter("capitalIpo", "all"));
    }
    if (infoEanId) push("infoEanId", labels.infoEanId, infoEanId, () => setFilter("infoEanId", ""));
    if (infoLeiId) push("infoLeiId", labels.infoLeiId, infoLeiId, () => setFilter("infoLeiId", ""));
    if (foundedPeriod !== "all") {
      const fp = foundedOptions.find((o) => o.code === foundedPeriod);
      push("foundedPeriod", labels.foundedDate, fp?.label ?? foundedPeriod, () => setFilter("foundedPeriod", "all"));
    }
    if (employeesMin > 0 || employeesMax < 5000) {
      push("employeesRange", labels.employees, `${employeesMin}–${employeesMax >= 5000 ? "5,000+" : employeesMax}`, () => { setFilter("employeesMin", 0); setFilter("employeesMax", 5000); });
    }
    if (revenueMin > 0 || revenueMax < 1000) {
      push("revenueRange", labels.revenue, `${revenueMin}–${revenueMax >= 1000 ? "1bn+" : revenueMax}M`, () => { setFilter("revenueMin", 0); setFilter("revenueMax", 1000); });
    }
    if (profitMin > 0 || profitMax < 1000) {
      push("profitRange", labels.grossProfit, `${profitMin}–${profitMax >= 1000 ? "1bn+" : profitMax}M`, () => { setFilter("profitMin", 0); setFilter("profitMax", 1000); });
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, industryText, industryCode, industrySecondaryText, industrySecondaryCode, zipcode, region, city, municipality, street, streetcode, numberFrom, letterFrom, contactPhone, contactEmail, contactWww, size, employmentAmount, companyformCode, companyformDescription, companyformHolding, companystatusCode, statusBankrupt, capitalCapital, capitalCurrency, capitalIpo, infoEanId, infoLeiId, foundedPeriod, employeesMin, employeesMax, revenueMin, revenueMax, profitMin, profitMax, locale]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (industryText) count++;
    if (industryCode !== "all") count++;
    if (industrySecondaryText) count++;
    if (industrySecondaryCode) count++;
    if (size !== "all") count++;
    if (employmentAmount) count++;
    if (companyformCode || companyformDescription) count++;
    if (companyformHolding !== "all") count++;
    if (companystatusCode) count++;
    if (statusBankrupt !== "all") count++;
    if (capitalCapital) count++;
    if (capitalCurrency) count++;
    if (capitalIpo !== "all") count++;
    if (infoEanId) count++;
    if (infoLeiId) count++;
    if (zipcode) count++;
    if (!zipcode && region !== "all") count++;
    if (city) count++;
    if (municipality) count++;
    if (street) count++;
    if (streetcode) count++;
    if (numberFrom) count++;
    if (letterFrom) count++;
    if (contactPhone) count++;
    if (contactEmail) count++;
    if (contactWww) count++;
    if (foundedPeriod !== "all") count++;
    if (employeesMin > 0 || employeesMax < 5000) count++;
    if (revenueMin > 0 || revenueMax < 1000) count++;
    if (profitMin > 0 || profitMax < 1000) count++;
    return count;
  }, [industryText, industryCode, industrySecondaryText, industrySecondaryCode, size, employmentAmount, companyformCode, companyformDescription, companyformHolding, companystatusCode, statusBankrupt, capitalCapital, capitalCurrency, capitalIpo, infoEanId, infoLeiId, zipcode, region, city, municipality, street, streetcode, numberFrom, letterFrom, contactPhone, contactEmail, contactWww, foundedPeriod, employeesMin, employeesMax, revenueMin, revenueMax, profitMin, profitMax]);

  return (
    <VideoTrigger featureKey="search">
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
              className="h-12 px-3 sm:px-6 rounded-xl shrink-0 gap-2 font-bold"
              onClick={handleSearch}
              disabled={isLoading || isFetching}
            >
              {(isLoading || isFetching) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              <span className="hidden sm:inline">{s.searchButton}</span>
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
            <div className="mt-4 pt-4 border-t border-border/30 animate-slide-down">
              {/* Active chips bar */}
              <div className="pb-4 mb-2 border-b border-border/30">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                    {s.filters.activeFilters}
                    {activeChips.length > 0 && (
                      <span className="ml-1.5 tabular-nums text-foreground/60">({activeChips.length})</span>
                    )}
                  </span>
                  {activeChips.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      <RotateCcw className="size-3" />
                      {s.filters.clearFilters}
                    </button>
                  )}
                </div>
                <ActiveFilterChips
                  chips={activeChips}
                  emptyLabel={locale === "da" ? "Ingen aktive filtre" : "No active filters"}
                />
              </div>

              {/* Industry & Company */}
              <FilterSection title={s.filters.sectionIdentity} icon={Building2}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FilterField label={s.filters.industry} helpInfo={filterHelp.industry} helpLabels={filterHelpLabels}>
                    <Input
                      className="h-9"
                      placeholder={s.filters.industryPlaceholder}
                      value={industryText}
                      onChange={(e) => setFilter("industryText", e.target.value)}
                    />
                  </FilterField>
                  <FilterField label={s.filters.industryCode} helpInfo={filterHelp.industryCode} helpLabels={filterHelpLabels}>
                    <FilterSelect value={industryCode} onChange={(v) => setFilter("industryCode", v)}>
                      <option value="all">{s.filters.industryCodePlaceholder}</option>
                      {s.industries.filter((i) => i.code !== "all").map((ind) => (
                        <option key={ind.code} value={ind.code}>{ind.label}</option>
                      ))}
                    </FilterSelect>
                  </FilterField>
                  <FilterField label={s.filters.industrySecondaryCode} help={s.filters.industrySecondaryCodeHelp} helpInfo={filterHelp.industrySecondaryCode} helpLabels={filterHelpLabels}>
                    <Input
                      className="h-9 font-mono tabular-nums"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder={s.filters.industrySecondaryCodePlaceholder}
                      value={industrySecondaryCode}
                      onChange={(e) => setFilter("industrySecondaryCode", e.target.value.replace(/\D/g, ""))}
                    />
                  </FilterField>
                </div>
              </FilterSection>

              {/* Location */}
              <FilterSection title={s.filters.sectionLocation} icon={MapPin}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FilterField
                    label={s.filters.zipcode}
                    help={locale === "da" ? "Tilsidesætter regionsvalget." : "Overrides region selection."}
                    helpInfo={filterHelp.zipcode}
                    helpLabels={filterHelpLabels}
                  >
                    <Input
                      className="h-9 font-mono tabular-nums"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      placeholder={s.filters.zipcodePlaceholder}
                      value={zipcode}
                      onChange={(e) => setFilter("zipcode", e.target.value.replace(/\D/g, ""))}
                    />
                  </FilterField>
                  <FilterField
                    label={s.filters.region}
                    help={zipcode
                      ? (locale === "da" ? "Låst — postnummer aktivt." : "Locked — ZIP active.")
                      : (region !== "all" ? regionHelperCopy[region] : (locale === "da" ? "Vælg en region for regionale postnumre." : "Select a region for regional ZIPs."))
                    }
                    helpInfo={filterHelp.region}
                    helpLabels={filterHelpLabels}
                  >
                    <FilterSelect
                      value={region}
                      onChange={(v) => setFilter("region", v)}
                      disabled={!!zipcode}
                    >
                      <option value="all">{s.filters.regionPlaceholder}</option>
                      {s.regions.filter((r) => r.code !== "all").map((reg) => (
                        <option key={reg.code} value={reg.code}>{reg.label}</option>
                      ))}
                    </FilterSelect>
                  </FilterField>
                  <FilterField label={s.filters.city} helpInfo={filterHelp.city} helpLabels={filterHelpLabels}>
                    <Input
                      className="h-9"
                      placeholder={s.filters.cityPlaceholder}
                      value={city}
                      onChange={(e) => setFilter("city", e.target.value)}
                    />
                  </FilterField>
                </div>
              </FilterSection>

              {/* Workforce & age */}
              <FilterSection title={s.filters.sectionWorkforce} icon={Users}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FilterField label={s.filters.size} helpInfo={filterHelp.size} helpLabels={filterHelpLabels}>
                    <FilterSelect value={size} onChange={(v) => setFilter("size", v)}>
                      <option value="all">{s.filters.sizePlaceholder}</option>
                      {s.sizes.filter((sz) => sz.code !== "all").map((sz) => (
                        <option key={sz.code} value={sz.code}>{sz.label}</option>
                      ))}
                    </FilterSelect>
                  </FilterField>
                  <FilterField label={s.filters.employmentAmount} help={s.filters.employmentAmountHelp} helpInfo={filterHelp.employmentAmount} helpLabels={filterHelpLabels}>
                    <Input
                      className="h-9 font-mono tabular-nums"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder={s.filters.employmentAmountPlaceholder}
                      value={employmentAmount}
                      onChange={(e) => setFilter("employmentAmount", e.target.value.replace(/\D/g, ""))}
                    />
                  </FilterField>
                  <FilterField label={s.filters.foundedDate} helpInfo={filterHelp.foundedDate} helpLabels={filterHelpLabels}>
                    <FilterSelect value={foundedPeriod} onChange={(v) => setFilter("foundedPeriod", v)}>
                      {foundedOptions.map((o) => (
                        <option key={o.code} value={o.code}>{o.label}</option>
                      ))}
                    </FilterSelect>
                  </FilterField>
                </div>
              </FilterSection>

              {/* Financials (segmentation post-filters) */}
              <FilterSection title={s.filters.sectionFinancials} icon={TrendingUp}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                  <RangeSlider label={s.filters.revenue} min={0} max={1000} minVal={revenueMin} maxVal={revenueMax} onMinChange={(v) => setFilter("revenueMin", v)} onMaxChange={(v) => setFilter("revenueMax", v)} formatMax="1 bn+" helpInfo={filterHelp.revenue} helpLabels={filterHelpLabels} />
                  <RangeSlider label={s.filters.grossProfit} min={0} max={1000} minVal={profitMin} maxVal={profitMax} onMinChange={(v) => setFilter("profitMin", v)} onMaxChange={(v) => setFilter("profitMax", v)} formatMax="1 bn+" helpInfo={filterHelp.grossProfit} helpLabels={filterHelpLabels} />
                  <RangeSlider label={s.filters.employees} min={0} max={5000} minVal={employeesMin} maxVal={employeesMax} onMinChange={(v) => setFilter("employeesMin", v)} onMaxChange={(v) => setFilter("employeesMax", v)} formatMax="5,000+" helpInfo={filterHelp.employees} helpLabels={filterHelpLabels} />
                </div>
              </FilterSection>

              {/* Advanced */}
              <section className="border-t border-border/30 pt-4 mt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70 hover:text-foreground transition-colors mb-3"
                >
                  <ChevronRight className={cn("size-3.5 transition-transform", showAdvanced && "rotate-90")} />
                  {s.filters.sectionAdvanced}
                </button>
                {showAdvanced && (
                  <div className="space-y-5 pb-1">
                    {/* Legal and registry status */}
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2.5">
                        {s.filters.subsectionLegal}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
                        <FilterField label={s.filters.companyformCode} help={s.filters.companyformCodeHelp} helpInfo={filterHelp.companyformCode} helpLabels={filterHelpLabels}>
                          <FilterSelect
                            value={companyformCode || "all"}
                            onChange={(v) => {
                              if (v === "all") {
                                setFilter("companyformCode", "");
                                setFilter("companyformDescription", "");
                                return;
                              }
                              const form = companyFormOptions.find((o) => o.code === v);
                              setFilter("companyformCode", v);
                              setFilter("companyformDescription", form?.description ?? "");
                            }}
                          >
                            <option value="all">{s.filters.companyformCodePlaceholder}</option>
                            {companyFormOptions.map((o) => (
                              <option key={o.code} value={o.code}>{o.label}</option>
                            ))}
                          </FilterSelect>
                        </FilterField>
                        <FilterField label={s.filters.companyformHolding} helpInfo={filterHelp.companyformHolding} helpLabels={filterHelpLabels}>
                          <FilterSelect value={companyformHolding} onChange={(v) => setFilter("companyformHolding", v)}>
                            <option value="all">{s.filters.companyformHoldingPlaceholder}</option>
                            {booleanOptions.filter((o) => o.code !== "all").map((o) => (
                              <option key={o.code} value={o.code}>{o.label}</option>
                            ))}
                          </FilterSelect>
                        </FilterField>
                        <FilterField label={s.filters.companystatusCode} help={s.filters.companystatusCodeHelp} helpInfo={filterHelp.companystatusCode} helpLabels={filterHelpLabels}>
                          <FilterSelect value={companystatusCode || "all"} onChange={(v) => setFilter("companystatusCode", v === "all" ? "" : v)}>
                            <option value="all">{s.filters.companystatusCodePlaceholder}</option>
                            {statusOptions.map((o) => (
                              <option key={o.code} value={o.code}>{o.label}</option>
                            ))}
                          </FilterSelect>
                        </FilterField>
                        <FilterField label={s.filters.statusBankrupt} helpInfo={filterHelp.statusBankrupt} helpLabels={filterHelpLabels}>
                          <FilterSelect value={statusBankrupt} onChange={(v) => setFilter("statusBankrupt", v)}>
                            <option value="all">{s.filters.statusBankruptPlaceholder}</option>
                            {booleanOptions.filter((o) => o.code !== "all").map((o) => (
                              <option key={o.code} value={o.code}>{o.label}</option>
                            ))}
                          </FilterSelect>
                        </FilterField>
                      </div>
                    </div>

                    {/* Capital and registry identifiers */}
                    <div className="pt-4 border-t border-border/30">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2.5">
                        {s.filters.subsectionCapital}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
                        <FilterField label={s.filters.capitalCapital} helpInfo={filterHelp.capitalCapital} helpLabels={filterHelpLabels}>
                          <Input
                            value={capitalCapital}
                            onChange={(e) => setFilter("capitalCapital", e.target.value.replace(/\D/g, ""))}
                            placeholder={s.filters.capitalCapitalPlaceholder}
                            inputMode="numeric"
                            className="h-9 font-mono tabular-nums"
                          />
                        </FilterField>
                        <FilterField label={s.filters.capitalCurrency} helpInfo={filterHelp.capitalCurrency} helpLabels={filterHelpLabels}>
                          <FilterSelect value={capitalCurrency || "all"} onChange={(v) => setFilter("capitalCurrency", v === "all" ? "" : v)}>
                            <option value="all">{s.filters.capitalCurrencyPlaceholder}</option>
                            {currencyOptions.map((currency) => (
                              <option key={currency} value={currency}>{currency}</option>
                            ))}
                          </FilterSelect>
                        </FilterField>
                        <FilterField label={s.filters.capitalIpo} helpInfo={filterHelp.capitalIpo} helpLabels={filterHelpLabels}>
                          <FilterSelect value={capitalIpo} onChange={(v) => setFilter("capitalIpo", v)}>
                            <option value="all">{s.filters.capitalIpoPlaceholder}</option>
                            {booleanOptions.filter((o) => o.code !== "all").map((o) => (
                              <option key={o.code} value={o.code}>{o.label}</option>
                            ))}
                          </FilterSelect>
                        </FilterField>
                        <FilterField label={s.filters.infoEanId} helpInfo={filterHelp.infoEanId} helpLabels={filterHelpLabels}>
                          <Input
                            value={infoEanId}
                            onChange={(e) => setFilter("infoEanId", e.target.value.replace(/\D/g, ""))}
                            placeholder={s.filters.infoEanIdPlaceholder}
                            inputMode="numeric"
                            className="h-9 font-mono tabular-nums"
                          />
                        </FilterField>
                        <FilterField label={s.filters.infoLeiId} helpInfo={filterHelp.infoLeiId} helpLabels={filterHelpLabels}>
                          <Input
                            value={infoLeiId}
                            onChange={(e) => setFilter("infoLeiId", e.target.value.toUpperCase())}
                            placeholder={s.filters.infoLeiIdPlaceholder}
                            className="h-9 font-mono uppercase"
                          />
                        </FilterField>
                      </div>
                    </div>

                    {/* Address detail */}
                    <div className="pt-4 border-t border-border/30">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2.5">
                        {s.filters.subsectionAddress}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
                        <FilterField label={s.filters.street} helpInfo={filterHelp.street} helpLabels={filterHelpLabels}>
                          <Input
                            value={street}
                            onChange={(e) => setFilter("street", e.target.value)}
                            placeholder={s.filters.streetPlaceholder}
                            className="h-9"
                          />
                        </FilterField>
                        <FilterField label={s.filters.streetcode} help={s.filters.streetcodeHelp} helpInfo={filterHelp.streetcode} helpLabels={filterHelpLabels}>
                          <Input
                            value={streetcode}
                            onChange={(e) => setFilter("streetcode", e.target.value.replace(/\D/g, ""))}
                            placeholder={s.filters.streetcodePlaceholder}
                            inputMode="numeric"
                            pattern="\d{1,4}"
                            maxLength={4}
                            className="h-9 font-mono tabular-nums"
                          />
                        </FilterField>
                        <div className="grid grid-cols-2 gap-3">
                          <FilterField label={s.filters.numberFrom} helpInfo={filterHelp.numberFrom} helpLabels={filterHelpLabels}>
                            <Input
                              value={numberFrom}
                              onChange={(e) => setFilter("numberFrom", e.target.value)}
                              placeholder={s.filters.numberFromPlaceholder}
                              inputMode="numeric"
                              className="h-9 font-mono tabular-nums"
                            />
                          </FilterField>
                          <FilterField label={s.filters.letterFrom} helpInfo={filterHelp.letterFrom} helpLabels={filterHelpLabels}>
                            <Input
                              value={letterFrom}
                              onChange={(e) => setFilter("letterFrom", e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())}
                              placeholder={s.filters.letterFromPlaceholder}
                              maxLength={1}
                              className="h-9 font-mono uppercase"
                            />
                          </FilterField>
                        </div>
                        <FilterField label={s.filters.municipality} help={s.filters.municipalityHelp} helpInfo={filterHelp.municipality} helpLabels={filterHelpLabels}>
                          <Input
                            value={municipality}
                            onChange={(e) => setFilter("municipality", e.target.value.replace(/\D/g, ""))}
                            placeholder={s.filters.municipalityPlaceholder}
                            inputMode="numeric"
                            pattern="\d{1,3}"
                            maxLength={3}
                            className="h-9 font-mono tabular-nums"
                          />
                        </FilterField>
                        <FilterField label={s.filters.industrySecondaryText} helpInfo={filterHelp.industrySecondaryText} helpLabels={filterHelpLabels}>
                          <Input
                            value={industrySecondaryText}
                            onChange={(e) => setFilter("industrySecondaryText", e.target.value)}
                            placeholder={s.filters.industrySecondaryTextPlaceholder}
                            className="h-9"
                          />
                        </FilterField>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="pt-4 border-t border-border/30">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2.5">
                        {s.filters.subsectionContact}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
                        <FilterField label={s.filters.contactPhone} helpInfo={filterHelp.contactPhone} helpLabels={filterHelpLabels}>
                          <Input
                            value={contactPhone}
                            onChange={(e) => setFilter("contactPhone", e.target.value)}
                            placeholder={s.filters.contactPhonePlaceholder}
                            inputMode="tel"
                            type="tel"
                            className="h-9 font-mono tabular-nums"
                          />
                        </FilterField>
                        <FilterField label={s.filters.contactEmail} helpInfo={filterHelp.contactEmail} helpLabels={filterHelpLabels}>
                          <Input
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setFilter("contactEmail", e.target.value)}
                            placeholder={s.filters.contactEmailPlaceholder}
                            inputMode="email"
                            className="h-9"
                          />
                        </FilterField>
                        <FilterField label={s.filters.contactWww} helpInfo={filterHelp.contactWww} helpLabels={filterHelpLabels}>
                          <Input
                            value={contactWww}
                            onChange={(e) => setFilter("contactWww", e.target.value)}
                            placeholder={s.filters.contactWwwPlaceholder}
                            inputMode="url"
                            className="h-9"
                          />
                        </FilterField>
                      </div>
                    </div>

                    {/* Compliance */}
                    <div className="pt-4 border-t border-border/30">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-2.5">
                        {s.filters.subsectionCompliance}
                      </h4>
                      <label htmlFor="skip-marketing-optout" className="flex items-start gap-3 cursor-pointer group">
                        <Checkbox
                          id="skip-marketing-optout"
                          checked={skipMarketingOptOut}
                          onCheckedChange={(v) => setFilter("skipMarketingOptOut", !!v)}
                          className="size-4 mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground group-hover:text-foreground/90">
                            <span>{s.filters.skipMarketingOptOut}</span>
                            <FilterHelpButton
                              info={filterHelp.skipMarketingOptOut}
                              whyLabel={filterHelpLabels.whyLabel}
                              howLabel={filterHelpLabels.howLabel}
                              openLabel={filterHelpLabels.openLabel}
                              closeLabel={filterHelpLabels.closeLabel}
                            />
                          </span>
                          <span className="block text-[11px] text-muted-foreground/70 mt-0.5">
                            {s.filters.skipMarketingOptOutHelp}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Loading state ────────────────────────────────────── */}
      {isLoading && <InlineLoader message={`${s.searchButton}...`} />}

      {/* ── Results ──────────────────────────────────────────── */}
      {!isLoading && hasSearched && results.length > 0 && (
        <>
          {/* Filter scope banner */}
          <p className="text-xs text-muted-foreground mb-3">
            {s.filterScopeBanner}
          </p>

          {/* Results header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {s.showing}{" "}
                <span className="font-bold text-foreground">{results.length}</span>{" "}
                {searchData?.truncated ? s.refineForMore : s.results}
              </p>
              {isFetching && <Loader2 className="size-3.5 text-primary animate-spin" />}
            </div>
            <div className="flex items-center gap-2">
              {selected.length > 0 && (
                <Button size="sm" className="rounded-full gap-2 h-8">
                  <Download className="size-3.5" />
                  {s.export} ({selected.length})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSaveModal(true)}
                className="gap-1.5 text-muted-foreground hover:text-primary h-8"
              >
                <Bookmark className="size-3.5" />
                <span className="hidden sm:inline">{s.saveSearch}</span>
              </Button>
            </div>
          </div>

          {/* Results — card-based, mobile-first */}
          <div className="space-y-3">
            {results.map((c, idx) => {
              const color = companyColors[idx % companyColors.length];
              const initials = c.name.split(" ").filter(w => w.length > 0).map(w => w[0]).join("").slice(0, 2).toUpperCase();
              const isSaved = savedCvrs.has(c.cvr);
              const isSaving = savingCvr === c.cvr;
              const isSelected = selectedSet.has(c.cvr);

              return (
                <div
                  key={c.cvr}
                  className={cn(
                    "group bg-white rounded-2xl transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,74,198,0.06)] hover:-translate-y-0.5 cursor-pointer",
                    isSelected && "ring-2 ring-primary/20 bg-primary/[0.02]"
                  )}
                  onClick={() => router.push(`/company/${c.cvr}`)}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                      {/* Checkbox */}
                      <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(c.cvr)}
                          className="size-4"
                        />
                      </div>

                      {/* Avatar */}
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        color.bg
                      )}>
                        <span className={cn("text-xs font-bold", color.text)}>{initials}</span>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        {/* Name + status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[15px] font-semibold text-foreground group-hover:text-blue-600 transition-colors truncate">
                            {c.name}
                          </h3>
                          {c.status && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                              {c.status}
                            </span>
                          )}
                          {c.form && (
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-50 text-slate-500">
                              {c.form}
                            </span>
                          )}
                          {c.isDissolved && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-red-50 text-red-600">
                              {s.dissolvedBadge}
                            </span>
                          )}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-1.5 mt-1 text-[12px] text-muted-foreground flex-wrap">
                          <span className="tabular-nums font-medium">{c.cvr}</span>
                          {c.city && (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span>{c.city}</span>
                            </>
                          )}
                          {c.employees && c.employees !== "\u2013" && (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span>{c.employees} {locale === "da" ? "ansatte" : "emp."}</span>
                            </>
                          )}
                          {c.founded && (
                            <>
                              <span className="text-muted-foreground/30 hidden sm:inline">·</span>
                              <span className="hidden sm:inline">{locale === "da" ? "Stiftet" : "Est."} {new Date(c.founded).getFullYear()}</span>
                            </>
                          )}
                        </div>

                        {/* Industry */}
                        {c.industry && (
                          <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">{c.industry}</p>
                        )}
                      </div>

                      {/* Actions — right side */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleSaveCompany(c, rawDataMap.get(c.cvr) || {})}
                          disabled={isSaving}
                          className="rounded-full"
                        >
                          <Heart className={cn(
                            "size-4 transition-all duration-200",
                            isSaved ? "text-red-500 fill-red-500" : "text-muted-foreground/20 group-hover:text-red-400"
                          )} />
                        </Button>
                        <ChevronRight className="size-4 text-muted-foreground/20 group-hover:text-blue-500 transition-colors hidden sm:block" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Refine hint */}
          <div className="mt-4 flex items-center justify-center gap-2 py-3">
            <Search className="size-3.5 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground/50">
              {s.refineHint}
            </p>
          </div>
        </>
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

      {!isLoading && hasSearched && results.length === 0 && !searchError && (
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
    </VideoTrigger>
  );
}
