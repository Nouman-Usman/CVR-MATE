"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signUp } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import { GoogleIcon } from "@/components/google-icon";
import { LogoFull } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Lock, ShieldCheck, Globe, Star, AlertCircle, TriangleAlert, Loader2 } from "lucide-react";

export default function SignupPage() {
  const { t, locale, toggleLocale } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (s <= 1) return t.auth.signup.strengthWeak;
    if (s === 2) return t.auth.signup.strengthMedium;
    if (s === 3) return t.auth.signup.strengthStrong;
    return t.auth.signup.strengthVeryStrong;
  };

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
    if (!agreedToTerms) {
      setError(
        locale === "da"
          ? "Du skal acceptere vilkårene"
          : "You must accept the terms"
      );
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await signUp.email({
        email,
        password,
        name,
      });

      if (authError) {
        setError(authError.message || "Sign up failed");
        setLoading(false);
        return;
      }

      router.push(`/verify-email?state=pending&email=${encodeURIComponent(email)}`);
    } catch {
      setError(
        locale === "da"
          ? "Noget gik galt. Prøv igen."
          : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    await signIn.social({ provider: "google", callbackURL: "/onboarding" });
  };

  const a = t.auth.signup;
  const strength = getPasswordStrength();

  return (
    <main className="min-h-screen flex flex-col lg:flex-row">
      {/* Left branding panel */}
      <section className="hidden lg:flex flex-col shrink-0 w-[450px] sticky top-0 h-screen bg-slate-900 text-white relative overflow-hidden">
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
              {t.auth.brandTagline}
            </p>
          </div>

          <div className="flex flex-col gap-8">
            <div className="space-y-4">
              {a.features.map((f) => (
                <div key={f} className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="text-slate-300 text-sm font-medium">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-8 rounded-xl border border-white/10">
            <div className="flex gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-5 text-cyan-400 fill-current" />
              ))}
            </div>
            <blockquote className="text-lg font-medium leading-relaxed text-slate-100 mb-6 italic">
              &ldquo;{a.testimonial}&rdquo;
            </blockquote>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold">
                ML
              </div>
              <div>
                <p className="text-sm font-bold text-white">{a.testimonialName}</p>
                <p className="text-xs text-slate-400">{a.testimonialRole}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px]" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-400/10 rounded-full blur-[80px]" />
      </section>

      {/* Right form panel */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 bg-background min-h-screen">
        {/* Mobile logo */}
        <div className="lg:hidden mb-6 sm:mb-8 flex items-center justify-between w-full max-w-[480px]">
          <LogoFull size="small" />
          <Button variant="ghost" size="sm" onClick={toggleLocale}>
            <Globe className="size-4" />
            <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
          </Button>
        </div>

        <div className="w-full max-w-[480px]">
          <div className="mb-8 sm:mb-10 text-center lg:text-left flex justify-between items-start">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-[family-name:var(--font-manrope)] mb-2 sm:mb-3">
                {a.title}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground font-medium">
                {a.subtitle}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleLocale} className="hidden lg:flex shrink-0">
              <Globe className="size-4" />
              <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
            </Button>
          </div>

          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                {a.name}
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <User className="size-5" />
                </div>
                <Input
                  id="name"
                  placeholder={a.namePlaceholder}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="pl-11 py-3 sm:py-3.5 h-auto bg-slate-100 border-none"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                {a.email}
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <Mail className="size-5" />
                </div>
                <Input
                  id="signup-email"
                  placeholder={a.emailPlaceholder}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-11 py-3 sm:py-3.5 h-auto bg-slate-100 border-none"
                />
              </div>
            </div>

            {/* Password + Confirm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="signup-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                  {a.password}
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="size-5" />
                  </div>
                  <Input
                    id="signup-password"
                    placeholder={a.passwordPlaceholder}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="pl-11 py-3 sm:py-3.5 h-auto bg-slate-100 border-none"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                  {a.confirmPassword}
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                    <ShieldCheck className="size-5" />
                  </div>
                  <Input
                    id="confirm-password"
                    placeholder={a.passwordPlaceholder}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pl-11 py-3 sm:py-3.5 h-auto bg-slate-100 border-none"
                  />
                </div>
              </div>
            </div>

            {/* Password strength */}
            {password && (
              <div className="px-1 space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {a.strength}: {getStrengthLabel(strength)}
                </span>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-0.5">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-full w-1/4 rounded-full transition-colors ${
                        i < strength
                          ? strength <= 1
                            ? "bg-red-400"
                            : strength <= 2
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
              <p className="text-xs text-destructive px-1 flex items-center gap-1">
                <TriangleAlert className="size-3.5" />
                {locale === "da"
                  ? "Adgangskoderne matcher ikke"
                  : "Passwords do not match"}
              </p>
            )}

            {/* Terms checkbox */}
            <div className="flex items-start gap-3 px-1 py-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground leading-tight font-normal cursor-pointer">
                {a.terms}{" "}
                <a className="text-primary font-semibold hover:underline" href="#">
                  {a.termsLink}
                </a>{" "}
                {a.termsEnd}
              </Label>
            </div>

            {/* Submit */}
            <Button
              variant="gradient"
              size="lg"
              className="w-full py-3.5 sm:py-4 h-auto font-bold text-base"
              type="submit"
              disabled={loading || (!!confirmPassword && password !== confirmPassword)}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {locale === "da" ? "Opretter..." : "Creating..."}
                </span>
              ) : (
                a.submit
              )}
            </Button>

            {/* Divider */}
            <div className="relative py-3 sm:py-4">
              <Separator />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-background px-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {a.or}
                </span>
              </div>
            </div>

            {/* Google */}
            <Button
              variant="outline"
              size="lg"
              className="w-full py-3 sm:py-3.5 h-auto font-semibold shadow-sm"
              type="button"
              onClick={handleGoogleSignup}
            >
              <GoogleIcon />
              <span>{a.google}</span>
            </Button>
          </form>

          {/* Footer link */}
          <div className="mt-8 sm:mt-10 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              {a.hasAccount}
              <Link className="text-primary font-bold hover:underline ml-1" href="/login">
                {a.loginLink}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
