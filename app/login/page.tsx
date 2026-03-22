"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import { GoogleIcon } from "@/components/google-icon";
import { LogoFull } from "@/components/logo";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { t, locale, toggleLocale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await signIn.email({ email, password });

    if (authError) {
      setError(authError.message || "Login failed");
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
  };

  const handleGoogleLogin = async () => {
    await signIn.social({ provider: "google", callbackURL: callbackUrl });
  };

  const a = t.auth.login;

  return (
    <main className="min-h-screen flex flex-col lg:flex-row">
      {/* Left branding panel */}
      <section className="hidden lg:flex flex-col justify-between w-[450px] bg-[#0f172a] p-12 shrink-0 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10">
          <LogoFull size="large" variant="dark" />
          <p className="mt-4 text-slate-400 font-medium tracking-tight">
            {t.auth.brandTagline}
          </p>
        </div>
        <div className="relative z-10 mt-auto">
          <div className="flex gap-1 mb-4 text-cyan-400">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
            ))}
          </div>
          <blockquote className="text-white text-lg font-[family-name:var(--font-manrope)] font-semibold leading-relaxed italic">
            &ldquo;{a.testimonial}&rdquo;
          </blockquote>
          <div className="mt-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm">
              MJ
            </div>
            <div>
              <p className="text-white text-sm font-bold">{a.testimonialName}</p>
              <p className="text-slate-500 text-xs">{a.testimonialRole}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Right form panel */}
      <section className="flex-1 bg-white flex items-center justify-center p-6 md:p-12 lg:p-24">
        <div className="w-full max-w-[440px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-between mb-12">
            <LogoFull size="small" />
            <button
              onClick={toggleLocale}
              className="text-slate-500 hover:bg-slate-50 p-2 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">language</span>
              <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
            </button>
          </div>

          <header className="mb-10">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-[family-name:var(--font-manrope)] font-extrabold text-3xl text-slate-900 tracking-tight mb-2">
                  {a.title}
                </h2>
                <p className="text-slate-500 font-medium">{a.subtitle}</p>
              </div>
              <button
                onClick={toggleLocale}
                className="hidden lg:flex text-slate-500 hover:bg-slate-50 p-2 rounded-lg items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">language</span>
                <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
              </button>
            </div>
          </header>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-500 ml-1" htmlFor="email">
                {a.email}
              </label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                id="email"
                type="email"
                placeholder={a.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-sm font-semibold text-slate-500" htmlFor="password">
                  {a.password}
                </label>
                <a className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors" href="#">
                  {a.forgotPassword}
                </a>
              </div>
              <div className="relative">
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={a.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-1">
              <input
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                id="remember"
                type="checkbox"
              />
              <label className="text-xs font-medium text-slate-500 cursor-pointer select-none" htmlFor="remember">
                {a.rememberMe}
              </label>
            </div>

            <button
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold rounded-lg shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              type="submit"
              disabled={loading}
            >
              <span>{loading ? "..." : a.submit}</span>
              {!loading && (
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              )}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest text-slate-400 bg-white px-4">
                {a.or}
              </div>
            </div>

            <button
              className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
              type="button"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon />
              <span>{a.google}</span>
            </button>
          </form>

          <footer className="mt-10 text-center">
            <p className="text-sm font-medium text-slate-500">
              {a.noAccount}
              <Link className="text-blue-600 font-bold hover:underline ml-1" href="/signup">
                {a.createAccount}
              </Link>
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
