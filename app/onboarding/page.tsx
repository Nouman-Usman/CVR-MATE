"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { LogoFull } from "@/components/logo";

const STEPS = [0, 1, 2] as const;

const TONE_PREVIEWS: Record<string, Record<string, string>> = {
  formal: {
    en: "Dear Mr. Jensen, I am writing to introduce our services that may benefit your organization...",
    da: "Kære Hr. Jensen, Jeg skriver for at præsentere vores ydelser, som kan gavne jeres organisation...",
  },
  friendly: {
    en: "Hi Morten! I noticed your company is growing fast — I think we could be a great fit. Let me share how...",
    da: "Hej Morten! Jeg lagde mærke til at jeres virksomhed vokser hurtigt — jeg tror vi kunne passe godt sammen...",
  },
  casual: {
    en: "Hey Morten — saw you're expanding. We help companies like yours scale faster. Quick chat this week?",
    da: "Hej Morten — så I er i gang med at udvide. Vi hjælper virksomheder som jeres med at skalere hurtigere. Kort snak i denne uge?",
  },
};

export default function OnboardingPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const o = t.onboarding;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cvrLoading, setCvrLoading] = useState(false);
  const [cvrStatus, setCvrStatus] = useState<"idle" | "found" | "notfound">("idle");
  const [error, setError] = useState("");

  // Step 1 fields
  const [cvr, setCvr] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryCode, setIndustryCode] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [employees, setEmployees] = useState<number | null>(null);
  const [website, setWebsite] = useState("");

  // Step 2 fields
  const [products, setProducts] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  // Step 3 fields
  const [tone, setTone] = useState("formal");

  const handleCvrLookup = async () => {
    if (!/^\d{8}$/.test(cvr)) return;
    setCvrLoading(true);
    setCvrStatus("idle");
    try {
      const res = await fetch("/api/brand/cvr-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat: cvr }),
      });
      if (!res.ok) {
        setCvrStatus("notfound");
        return;
      }
      const data = await res.json();
      if (data.companyName) setCompanyName(data.companyName);
      if (data.industry) setIndustry(data.industry);
      if (data.industryCode) setIndustryCode(data.industryCode);
      if (data.employees) {
        setEmployees(data.employees);
        // Auto-select size bracket
        const emp = data.employees;
        if (emp <= 4) setCompanySize("1-4");
        else if (emp <= 9) setCompanySize("5-9");
        else if (emp <= 19) setCompanySize("10-19");
        else if (emp <= 49) setCompanySize("20-49");
        else if (emp <= 99) setCompanySize("50-99");
        else setCompanySize("100+");
      }
      if (data.website) setWebsite(data.website);
      setCvrStatus("found");
    } catch {
      setCvrStatus("notfound");
    } finally {
      setCvrLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return companyName.trim().length > 0;
    if (step === 1) return products.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          cvr: cvr.trim() || null,
          industry: industry.trim() || null,
          industryCode: industryCode.trim() || null,
          companySize: companySize || null,
          employees,
          website: website.trim() || null,
          products: products.trim(),
          targetAudience: targetAudience.trim() || null,
          tone,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      sessionStorage.setItem("onboarding_complete", "true");
      router.push("/dashboard");
    } catch {
      setError(locale === "da" ? "Noget gik galt. Prøv igen." : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    sessionStorage.setItem("onboarding_skipped", "true");
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — Progress */}
      <section className="hidden lg:flex flex-col shrink-0 w-[400px] sticky top-0 h-screen bg-slate-900 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: "#0f172a",
            backgroundImage:
              "radial-gradient(at 0% 0%, rgba(37,99,235,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(57,184,253,0.1) 0px, transparent 50%)",
          }}
        />
        <div className="flex flex-col justify-between p-12 h-full z-10">
          <div>
            <LogoFull size="large" variant="dark" />
            <p className="text-slate-400 font-medium tracking-tight mt-3">
              {o.subtitle}
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex flex-col gap-6">
            {STEPS.map((s) => {
              const titles = [o.step1Title, o.step2Title, o.step3Title];
              const descs = [o.step1Desc, o.step2Desc, o.step3Desc];
              const isActive = step === s;
              const isDone = step > s;
              return (
                <div key={s} className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm transition-all ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isActive
                          ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
                          : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {isDone ? (
                      <span className="material-symbols-outlined text-lg">check</span>
                    ) : (
                      s + 1
                    )}
                  </div>
                  <div>
                    <p
                      className={`font-bold text-sm ${
                        isActive ? "text-white" : isDone ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {titles[s]}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{descs[s]}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-slate-600">
            {locale === "da" ? "Trin" : "Step"} {step + 1} / 3
          </div>
        </div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px]" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-400/10 rounded-full blur-[80px]" />
      </section>

      {/* Right panel — Form */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 bg-[#f7f9fb] min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden mb-6 flex items-center justify-between w-full max-w-[560px]">
          <LogoFull size="small" />
          <span className="text-xs text-slate-400 font-bold">
            {step + 1} / 3
          </span>
        </div>

        <div className="w-full max-w-[560px]">
          {/* Mobile step dots */}
          <div className="lg:hidden flex gap-2 mb-6">
            {STEPS.map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  step > s
                    ? "bg-emerald-500"
                    : step === s
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500"
                      : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-[family-name:var(--font-manrope)] mb-2">
            {step === 0 ? o.step1Title : step === 1 ? o.step2Title : o.step3Title}
          </h2>
          <p className="text-sm text-slate-500 font-medium mb-8">
            {step === 0 ? o.step1Desc : step === 1 ? o.step2Desc : o.step3Desc}
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">error</span>
              {error}
            </div>
          )}

          {/* Step 1: Company Info */}
          {step === 0 && (
            <div className="space-y-5">
              {/* CVR Lookup */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  {o.cvrLabel}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-xl">tag</span>
                    </div>
                    <input
                      className="w-full bg-slate-100 border-none rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-400"
                      placeholder={o.cvrPlaceholder}
                      type="text"
                      maxLength={8}
                      value={cvr}
                      onChange={(e) => {
                        setCvr(e.target.value.replace(/\D/g, ""));
                        setCvrStatus("idle");
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCvrLookup}
                    disabled={!/^\d{8}$/.test(cvr) || cvrLoading}
                    className="px-5 py-3 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                  >
                    {cvrLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        {o.cvrLooking}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">search</span>
                        {o.cvrLookup}
                      </>
                    )}
                  </button>
                </div>
                {cvrStatus === "found" && (
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 px-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {o.cvrFound}
                  </p>
                )}
                {cvrStatus === "notfound" && (
                  <p className="text-xs text-amber-600 font-medium flex items-center gap-1 px-1">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    {o.cvrNotFound}
                  </p>
                )}
              </div>

              {/* Company Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  {o.companyName} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-xl">apartment</span>
                  </div>
                  <input
                    className="w-full bg-slate-100 border-none rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder={o.companyNamePlaceholder}
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Industry */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  {o.industry}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-xl">category</span>
                  </div>
                  <input
                    className="w-full bg-slate-100 border-none rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder={o.industryPlaceholder}
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </div>
              </div>

              {/* Company Size + Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                    {o.companySize}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-xl">groups</span>
                    </div>
                    <select
                      className="w-full bg-slate-100 border-none rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 appearance-none"
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                    >
                      <option value="">{o.companySizePlaceholder}</option>
                      {o.sizes.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                    {o.website}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-xl">language</span>
                    </div>
                    <input
                      className="w-full bg-slate-100 border-none rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-400"
                      placeholder={o.websitePlaceholder}
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Products & Target Audience */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  {o.products} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-4 pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                  </div>
                  <textarea
                    className="w-full bg-slate-100 border-none rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-400 min-h-[120px] resize-y"
                    placeholder={o.productsPlaceholder}
                    value={products}
                    onChange={(e) => setProducts(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-slate-400 px-1">{o.productsHelp}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  {o.targetAudience}
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-4 pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-xl">target</span>
                  </div>
                  <textarea
                    className="w-full bg-slate-100 border-none rounded-lg py-3 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-400 min-h-[100px] resize-y"
                    placeholder={o.targetAudiencePlaceholder}
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                  />
                </div>
                <p className="text-xs text-slate-400 px-1">{o.targetAudienceHelp}</p>
              </div>
            </div>
          )}

          {/* Step 3: Communication Style */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid gap-4">
                {(["formal", "friendly", "casual"] as const).map((t) => {
                  const labels = {
                    formal: { name: o.toneFormal, desc: o.toneFormalDesc, icon: "gavel" },
                    friendly: { name: o.toneFriendly, desc: o.toneFriendlyDesc, icon: "sentiment_satisfied" },
                    casual: { name: o.toneCasual, desc: o.toneCasualDesc, icon: "chat_bubble" },
                  };
                  const isSelected = tone === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50/50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <span
                          className={`material-symbols-outlined text-2xl ${
                            isSelected ? "text-blue-600" : "text-slate-400"
                          }`}
                        >
                          {labels[t].icon}
                        </span>
                        <div>
                          <p className={`font-bold text-sm ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                            {labels[t].name}
                          </p>
                          <p className="text-xs text-slate-500">{labels[t].desc}</p>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-blue-600 ml-auto">check_circle</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Tone Preview */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  {o.tonePreview}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed italic">
                  &ldquo;{TONE_PREVIEWS[tone][locale]}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex items-center justify-between gap-4">
            <div>
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-3 text-slate-600 font-semibold rounded-lg hover:bg-slate-100 transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  {o.back}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-3 text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
              >
                {o.skip}
              </button>

              {step < 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                >
                  {o.next}
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      {o.completing}
                    </>
                  ) : (
                    <>
                      {o.complete}
                      <span className="material-symbols-outlined text-lg">check</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div> 
      </section>
    </main>
  );
}
