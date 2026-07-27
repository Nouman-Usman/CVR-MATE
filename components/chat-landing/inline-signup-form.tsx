"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";

export function InlineSignupForm({
  sessionId,
  onSignedUp,
}: {
  sessionId: string;
  onSignedUp: (params: { email: string }) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // The route creates the account server-side (better-auth) and binds the
      // trial in one step — the client never asserts an identity of its own.
      const res = await fetch("/api/chat-landing/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name, email, password }),
      });
      if (!res.ok) {
        // Surface the server's reason — a re-used session says so plainly
        // instead of an unactionable "try again".
        const data = await res.json().catch(() => null);
        // A spent session (409) can never succeed again, so drop the cached id
        // — a reload then starts a fresh chat instead of dead-ending forever.
        if (res.status === 409) {
          sessionStorage.removeItem("chat-landing-session-id");
        }
        setError(data?.error || t.chat.signup.errTrial);
        setLoading(false);
        return;
      }

      onSignedUp({ email });
    } catch {
      setError(t.chat.signup.errGeneric);
      setLoading(false);
    }
  };

  const fieldClass =
    "bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 rounded-lg h-10 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/20";
  const labelClass = "text-xs font-mono uppercase tracking-wide text-slate-400";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 space-y-3"
    >
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="chat-landing-name" className={labelClass}>{t.chat.signup.name}</Label>
        <Input id="chat-landing-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="chat-landing-email" className={labelClass}>{t.chat.signup.email}</Label>
        <Input id="chat-landing-email" className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="chat-landing-password" className={labelClass}>{t.chat.signup.password}</Label>
        <Input
          id="chat-landing-password"
          className={fieldClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <Button type="submit" disabled={loading} variant="gradient" size="lg" className="w-full rounded-xl">
        {loading ? <Loader2 className="size-4 animate-spin" /> : t.chat.signup.submit}
      </Button>
    </form>
  );
}
