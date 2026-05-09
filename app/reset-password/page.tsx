"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import { LogoFull } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowRight, CheckCircle, Globe, Eye, EyeOff, TriangleAlert } from "lucide-react";

export default function ResetPasswordPage() {
  const { t, locale, toggleLocale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const getPasswordStrength = () => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  };

  const getStrengthLabel = (s: number) => {
    const labels = {
      da: { weak: "Svag", medium: "Middel", strong: "Stærk", veryStrong: "Meget stærk" },
      en: { weak: "Weak", medium: "Medium", strong: "Strong", veryStrong: "Very strong" },
    };
    const l = labels[locale] || labels.en;
    if (s <= 1) return l.weak;
    if (s === 2) return l.medium;
    if (s === 3) return l.strong;
    return l.veryStrong;
  };

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="size-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Invalid reset link</h2>
          <p className="text-muted-foreground mb-6">
            {locale === "da"
              ? "Nulstillinkslinket er ugyldigt eller udløbet. Anmod om et nyt."
              : "The reset link is invalid or expired. Request a new one."}
          </p>
          <Link href="/forgot-password">
            <Button>
              {locale === "da" ? "Anmod nyt link" : "Request new link"}
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(
        locale === "da"
          ? "Adgangskoderne matcher ikke"
          : "Passwords do not match"
      );
      return;
    }

    if (password.length < 8) {
      setError(
        locale === "da"
          ? "Adgangskode skal være mindst 8 tegn"
          : "Password must be at least 8 characters"
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const text = await response.text();

      if (!response.ok) {
        try {
          const data = JSON.parse(text);
          setError(data.error || "Failed to reset password");
        } catch {
          setError("Failed to reset password");
        }
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  const rp = t.auth.resetPassword || t.auth.forgotPassword;

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
                  {locale === "da" ? "Opret ny adgangskode" : "Create new password"}
                </h2>
                <p className="text-muted-foreground font-medium">
                  {locale === "da"
                    ? "Indtast en ny sikker adgangskode"
                    : "Enter a new secure password"}
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
                  {locale === "da"
                    ? "Adgangskoden er nulstillet. Du bliver omdirigeret til login..."
                    : "Password reset successfully. Redirecting to login..."}
                </AlertDescription>
              </Alert>
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
                <Label htmlFor="password" className="ml-1 text-muted-foreground font-semibold">
                  {t.auth.login.password}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t.auth.login.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="px-4 py-3 h-auto bg-slate-50 pr-12"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="ml-1 text-muted-foreground font-semibold">
                  {locale === "da" ? "Bekræft adgangskode" : "Confirm password"}
                </Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder={t.auth.login.passwordPlaceholder}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="px-4 py-3 h-auto bg-slate-50 pr-12"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Password strength */}
              {password && (
                <div className="ml-1 space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {locale === "da" ? "Styrke" : "Strength"}: {getStrengthLabel(getPasswordStrength())}
                  </span>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-0.5">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-full w-1/4 rounded-full transition-colors ${
                          i < getPasswordStrength()
                            ? getPasswordStrength() <= 1
                              ? "bg-red-400"
                              : getPasswordStrength() <= 2
                                ? "bg-amber-400"
                                : "bg-emerald-500"
                            : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Password mismatch warning */}
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive ml-1 flex items-center gap-1">
                  <TriangleAlert className="size-3.5" />
                  {locale === "da" ? "Adgangskoderne matcher ikke" : "Passwords do not match"}
                </p>
              )}

              <Button
                variant="gradient"
                size="lg"
                className="w-full py-3.5 h-auto font-bold text-base"
                type="submit"
                disabled={loading || (!!confirmPassword && password !== confirmPassword)}
              >
                <span>{loading ? "..." : locale === "da" ? "Nulstil adgangskode" : "Reset password"}</span>
                {!loading && <ArrowRight className="size-4" />}
              </Button>
            </form>
          )}

          <footer className="mt-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {locale === "da" ? "Tilbage til" : "Back to"}
              <Link className="text-primary font-bold hover:underline ml-1" href="/login">
                {locale === "da" ? "login" : "login"}
              </Link>
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
