"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogoFull } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, MailCheck, XCircle, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = searchParams.get("state");
  const email = searchParams.get("email") ?? "";
  const error = searchParams.get("error");

  // "pending" → just signed up, waiting for user to check inbox
  // error=TOKEN_EXPIRED / INVALID_TOKEN → link is bad
  // no params → verification just completed (auto-signed-in, redirect to dashboard)
  const isPending = state === "pending";
  const isExpired = error === "TOKEN_EXPIRED";
  const isInvalid = error === "INVALID_TOKEN";
  const isError = isExpired || isInvalid;
  const isVerified = !isPending && !isError;

  const [resendEmail, setResendEmail] = useState(email);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sent" | "error">("idle");

  // Auto-redirect after successful verification
  useEffect(() => {
    if (isVerified) {
      const t = setTimeout(() => router.push("/dashboard"), 3000);
      return () => clearTimeout(t);
    }
  }, [isVerified, router]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResending(true);
    setResendStatus("idle");
    try {
      await authClient.sendVerificationEmail({ email: resendEmail, callbackURL: "/verify-email" });
      setResendStatus("sent");
    } catch {
      setResendStatus("error");
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[440px] space-y-8">
        <div className="flex justify-center">
          <LogoFull size="large" />
        </div>

        {/* ── Pending: just signed up ── */}
        {isPending && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Mail className="size-8 text-blue-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tight font-[family-name:var(--font-manrope)]">
                Check your inbox
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We sent a verification link to{" "}
                {email ? (
                  <strong className="text-foreground">{email}</strong>
                ) : (
                  "your email address"
                )}
                . Click the link to activate your account.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-left text-sm text-muted-foreground space-y-2 border">
              <p className="font-semibold text-foreground">Didn&apos;t get it?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check your spam or junk folder</li>
                <li>The link expires in 24 hours</li>
                <li>Make sure <strong>{email}</strong> is correct</li>
              </ul>
            </div>

            <ResendSection
              email={resendEmail}
              setEmail={setResendEmail}
              onResend={handleResend}
              resending={resending}
              status={resendStatus}
            />

            <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
              Back to login
            </Button>
          </div>
        )}

        {/* ── Error: expired or invalid token ── */}
        {isError && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <XCircle className="size-8 text-amber-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tight font-[family-name:var(--font-manrope)]">
                {isExpired ? "Verification link expired" : "Invalid verification link"}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {isExpired
                  ? "This link is more than 24 hours old. Request a new one below."
                  : "This verification link is invalid or has already been used. Request a new one below."}
              </p>
            </div>

            <ResendSection
              email={resendEmail}
              setEmail={setResendEmail}
              onResend={handleResend}
              resending={resending}
              status={resendStatus}
            />

            <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
              Back to login
            </Button>
          </div>
        )}

        {/* ── Verified: auto-redirecting ── */}
        {isVerified && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tight font-[family-name:var(--font-manrope)]">
                Email verified!
              </h1>
              <p className="text-muted-foreground text-sm">
                Your account is active. Redirecting you to your dashboard…
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Taking you to dashboard</span>
            </div>
            <Button onClick={() => router.push("/dashboard")}>
              Go to dashboard now
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

interface ResendSectionProps {
  email: string;
  setEmail: (v: string) => void;
  onResend: () => void;
  resending: boolean;
  status: "idle" | "sent" | "error";
}

function ResendSection({ email, setEmail, onResend, resending, status }: ResendSectionProps) {
  return (
    <div className="space-y-3">
      {status === "sent" && (
        <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-700">
          <MailCheck className="size-4" />
          <AlertDescription>New verification email sent! Check your inbox.</AlertDescription>
        </Alert>
      )}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Failed to send. Please try again or contact support.</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          type="button"
          variant="outline"
          onClick={onResend}
          disabled={resending || !email}
          className="shrink-0"
        >
          {resending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Resend"
          )}
        </Button>
      </div>
    </div>
  );
}
