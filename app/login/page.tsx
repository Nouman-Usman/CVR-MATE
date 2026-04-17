"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { useLanguage } from "@/lib/i18n/language-context";
import { GoogleIcon } from "@/components/google-icon";
import { LogoFull } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Eye, EyeOff, Globe, Star, AlertCircle, MailCheck } from "lucide-react";

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
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailNotVerified(false);
    setLoading(true);

    const { error: authError } = await signIn.email({ email, password });

    if (authError) {
      if ((authError as { code?: string }).code === "EMAIL_NOT_VERIFIED") {
        setEmailNotVerified(true);
      } else {
        setError(authError.message || "Login failed");
      }
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
              <Star key={i} className="size-5 fill-current" />
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
            <Button variant="ghost" size="sm" onClick={toggleLocale}>
              <Globe className="size-4" />
              <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
            </Button>
          </div>

          <header className="mb-10">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-[family-name:var(--font-manrope)] font-extrabold text-3xl text-slate-900 tracking-tight mb-2">
                  {a.title}
                </h2>
                <p className="text-muted-foreground font-medium">{a.subtitle}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={toggleLocale} className="hidden lg:flex">
                <Globe className="size-4" />
                <span className="text-xs font-bold">{locale === "da" ? "EN" : "DA"}</span>
              </Button>
            </div>
          </header>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {emailNotVerified && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                <MailCheck className="size-4" />
                <AlertDescription>
                  {locale === "da"
                    ? "Din e-mail er ikke verificeret. Vi har sendt dig en ny bekræftelsesmail — tjek din indbakke."
                    : "Your email isn't verified yet. We've sent you a new verification email — check your inbox."}
                  {" "}
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-2 hover:opacity-80"
                    onClick={() => router.push(`/verify-email?state=pending&email=${encodeURIComponent(email)}`)}
                  >
                    {locale === "da" ? "Åbn bekræftelsessiden" : "Open verification page"}
                  </button>
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="ml-1 text-muted-foreground font-semibold">
                {a.email}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={a.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="px-4 py-3 h-auto bg-slate-50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <Label htmlFor="password" className="text-muted-foreground font-semibold">
                  {a.password}
                </Label>
                <a className="text-xs font-bold text-primary hover:text-primary/80 transition-colors" href="#">
                  {a.forgotPassword}
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={a.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="px-4 py-3 h-auto bg-slate-50 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-1">
              <Checkbox id="remember" />
              <Label htmlFor="remember" className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
                {a.rememberMe}
              </Label>
            </div>

            <Button
              variant="gradient"
              size="lg"
              className="w-full py-3.5 h-auto font-bold text-base"
              type="submit"
              disabled={loading}
            >
              <span>{loading ? "..." : a.submit}</span>
              {!loading && <ArrowRight className="size-4" />}
            </Button>

            <div className="relative py-4">
              <Separator />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-white px-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {a.or}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full py-3 h-auto font-semibold"
              type="button"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon />
              <span>{a.google}</span>
            </Button>
          </form>

          <footer className="mt-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {a.noAccount}
              <Link className="text-primary font-bold hover:underline ml-1" href="/signup">
                {a.createAccount}
              </Link>
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
