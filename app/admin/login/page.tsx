"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/admin/overview");
      } else {
        const data = await res.json();
        setError(data.error ?? "Invalid credentials");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#2563eb] flex items-center justify-center shadow-md">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-[#191c1e] text-sm leading-tight">CVR-MATE</p>
            <p className="text-[10px] text-[#64748b] leading-tight uppercase tracking-wider">Admin Portal</p>
          </div>
        </div>

        <Card className="border-[#e2e8f0] shadow-sm">
          <CardHeader className="pt-6 pb-2 px-6">
            <h1 className="text-lg font-bold text-[#191c1e]">Sign in</h1>
            <p className="text-sm text-[#64748b] mt-0.5">Super-admin access only</p>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="border-[#e2e8f0] focus-visible:ring-[#2563eb] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-[#e2e8f0] focus-visible:ring-[#2563eb] text-sm"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium mt-1"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin mr-2" /> Signing in…</>
                ) : "Sign in →"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-[#94a3b8] mt-5">
          CVR-MATE Admin · Restricted access
        </p>
      </div>
    </div>
  );
}
