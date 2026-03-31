"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Globe,
  Megaphone,
} from "lucide-react";

// ---- Types ----

interface BrandData {
  companyName: string;
  cvr: string | null;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  products: string;
  targetAudience: string | null;
  tone: string;
}

// ---- Company size options ----

const companySizes = [
  { value: "1-4", label: "1–4 employees" },
  { value: "5-9", label: "5–9 employees" },
  { value: "10-19", label: "10–19 employees" },
  { value: "20-49", label: "20–49 employees" },
  { value: "50-99", label: "50–99 employees" },
  { value: "100+", label: "100+ employees" },
];

// ---- Tone options ----

const toneOptions = [
  { value: "formal", label: "Formal", description: "Professional and structured" },
  { value: "friendly", label: "Friendly", description: "Warm and approachable" },
  { value: "casual", label: "Casual", description: "Relaxed and conversational" },
];

// ---- Hook ----

function useBrand() {
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exists, setExists] = useState(false);

  const fetchBrand = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/brand");
      if (res.ok) {
        const data = await res.json();
        if (data.brand) {
          setBrand(data.brand);
          setExists(true);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrand();
  }, [fetchBrand]);

  return { brand, isLoading, exists, refetch: fetchBrand };
}

// ---- Page ----

export default function BrandPage() {
  const { brand, isLoading, exists, refetch } = useBrand();

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [cvr, setCvr] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [website, setWebsite] = useState("");
  const [products, setProducts] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("formal");

  // Action state
  const [saving, setSaving] = useState(false);
  const [cvrLoading, setCvrLoading] = useState(false);
  const [cvrStatus, setCvrStatus] = useState<"idle" | "found" | "notfound">("idle");

  // Sync form when brand loads
  useEffect(() => {
    if (brand) {
      setCompanyName(brand.companyName || "");
      setCvr(brand.cvr || "");
      setIndustry(brand.industry || "");
      setCompanySize(brand.companySize || "");
      setWebsite(brand.website || "");
      setProducts(brand.products || "");
      setTargetAudience(brand.targetAudience || "");
      setTone(brand.tone || "formal");
    }
  }, [brand]);

  async function handleCvrLookup() {
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
      if (data.employees) {
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
  }

  async function handleSave() {
    if (!companyName.trim() || !products.trim()) return;
    setSaving(true);
    try {
      const method = exists ? "PATCH" : "POST";
      const res = await fetch("/api/brand", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          cvr: cvr || null,
          industry: industry || null,
          companySize: companySize || null,
          website: website || null,
          products,
          targetAudience: targetAudience || null,
          tone,
        }),
      });
      if (res.ok) {
        toast.success("Brand profile saved");
        refetch();
      } else {
        toast.error("Failed to save brand profile");
      }
    } catch {
      toast.error("Failed to save brand profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* CVR Lookup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-4" />
            CVR Lookup
          </CardTitle>
          <CardDescription>
            Enter your Danish CVR number to auto-fill company details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="cvr-number">CVR Number</Label>
              <Input
                id="cvr-number"
                placeholder="e.g. 12345678"
                maxLength={8}
                value={cvr}
                onChange={(e) => {
                  setCvr(e.target.value.replace(/\D/g, ""));
                  setCvrStatus("idle");
                }}
                className="font-mono"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleCvrLookup}
              disabled={!/^\d{8}$/.test(cvr) || cvrLoading}
            >
              <Search className="size-4" data-icon="inline-start" />
              {cvrLoading ? "Looking up..." : "Lookup"}
            </Button>
          </div>
          {cvrStatus === "found" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              Company found — details have been filled in below.
            </p>
          )}
          {cvrStatus === "notfound" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
              <XCircle className="size-3.5" />
              Company not found. Please check the CVR number and try again.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" />
            Company Details
          </CardTitle>
          <CardDescription>
            Basic information about your company used across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme A/S"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. Software, Consulting"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Size</Label>
                  <Select value={companySize} onValueChange={(val) => setCompanySize(val ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {companySizes.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Voice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4" />
            Brand Voice
          </CardTitle>
          <CardDescription>
            Define how AI-generated content should sound when representing your
            company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="products">
                  Products &amp; Services{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="products"
                  value={products}
                  onChange={(e) => setProducts(e.target.value)}
                  placeholder="Describe what your company offers..."
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  Used by AI to generate relevant outreach and briefings.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-audience">Target Audience</Label>
                <Textarea
                  id="target-audience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Describe your ideal customers..."
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label>AI Tone</Label>
                <div className="grid grid-cols-3 gap-2">
                  {toneOptions.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTone(t.value)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        tone === t.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !companyName.trim() || !products.trim()}
                >
                  {saving ? "Saving..." : "Save Brand Profile"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
