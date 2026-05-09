"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import { LogoFull } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowRight, CheckCircle, Globe } from "lucide-react";

export default function ForgotPasswordPage() {
  const { t, locale, toggleLocale } = useLanguage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || "Failed to send reset email");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  const fp = t.auth.forgotPassword;

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
      </section>

      {/* Right form panel */}
      <section className="flex-1 bg-white flex items-center justify-center p-6 md:p-12 lg:p-24">
        <div className="w-full max-w-[440px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-between mb-12">
            <LogoFull size="small" />
            <Button variant="ghost" size="sm" onClick={toggleLocale}>
              <Globe className="size-4" />
              <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
            </Button>
          </div>

          <header className="mb-10">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-[family-name:var(--font-manrope)] font-extrabold text-3xl text-slate-900 tracking-tight mb-2">
                  {fp.title}
                </h2>
                <p className="text-muted-foreground font-medium">
                  {fp.subtitle}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={toggleLocale} className="hidden lg:flex">
                <Globe className="size-4" />
                <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
              </Button>
            </div>
          </header>

          {submitted ? (
            <div className="space-y-6">
              <Alert className="border-green-300 bg-green-50 text-green-900 [&>svg]:text-green-700">
                <CheckCircle className="size-4" />
                <AlertDescription>
                  {fp.submitted}
                </AlertDescription>
              </Alert>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  {fp.backToLogin}
                </Button>
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="ml-1 text-muted-foreground font-semibold">
                  {t.auth.login.email}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.auth.login.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="px-4 py-3 h-auto bg-slate-50"
                  disabled={loading}
                />
              </div>

              <Button
                variant="gradient"
                size="lg"
                className="w-full py-3.5 h-auto font-bold text-base"
                type="submit"
                disabled={loading}
              >
                <span>{loading ? "..." : fp.submit}</span>
                {!loading && <ArrowRight className="size-4" />}
              </Button>
            </form>
          )}

          <footer className="mt-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {fp.remembered}
              <Link className="text-primary font-bold hover:underline ml-1" href="/login">
                {fp.loginLink}
              </Link>
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
