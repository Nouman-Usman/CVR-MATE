"use client";

import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function InlineSignupForm({
  sessionId,
  onSignedUp,
}: {
  sessionId: string;
  onSignedUp: (params: { userId: string; email: string }) => void;
}) {
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
      const { data, error: authError } = await signUp.email({ email, password, name });
      if (authError || !data?.user?.id) {
        setError(authError?.message || "Sign up failed");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/chat-landing/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        setError("Something went wrong finishing signup. Please try again.");
        setLoading(false);
        return;
      }

      onSignedUp({ userId: data.user.id, email });
    } catch {
      setError("Something went wrong. Please try again.");
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
        <Label htmlFor="chat-landing-name" className={labelClass}>Name</Label>
        <Input id="chat-landing-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="chat-landing-email" className={labelClass}>Email</Label>
        <Input id="chat-landing-email" className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="chat-landing-password" className={labelClass}>Password</Label>
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
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Start my free trial"}
      </Button>
    </form>
  );
}
