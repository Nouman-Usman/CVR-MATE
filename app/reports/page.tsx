"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FileText, ShieldCheck, AlarmClock, Coins, Layers } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import RequiresOrganization from "@/components/workspace/requires-organization";
import { useWorkspaces } from "@/lib/hooks/use-workspace";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { QueryError } from "@/components/crm/QueryState";
import { formatOre, formatNumber } from "@/lib/format";
import { useContractExpiryReport, useSegmentsReport } from "@/lib/hooks/use-reports";

/**
 * Urgency ramp for the expiry buckets — deliberately fixed hexes, not theme
 * tokens, because "expired is red" must not flip with the colour scheme.
 *
 * Every value is held inside the luminance window where it clears WCAG 1.4.11's
 * 3:1 non-text contrast against BOTH card backgrounds (#ffffff light,
 * #1e293b dark). Four of the original picks were the -400/-500 Tailwind shades
 * and washed out on the white card (yellow-500 measured 1.92:1); they are one
 * step darker here. Anything lighter than roughly relative luminance 0.30
 * disappears on white, anything darker than 0.17 disappears on the dark card.
 */
const BUCKET_COLOR: Record<string, string> = {
  expired: "#e11d48", // rose-600  — 4.70:1 light / 3.11:1 dark
  d30: "#ea580c", // orange-600 — 3.56:1 / 4.11:1
  d60: "#d97706", // amber-600  — 3.19:1 / 4.59:1
  d90: "#3b82f6", // blue-500   — 3.68:1 / 3.98:1
  later: "#059669", // emerald-600 — 3.77:1 / 3.88:1
  none: "#64748b", // slate-500  — 4.76:1 / 3.07:1
};

/**
 * The luminance at which contrast against black and against white are equal
 * ((L + 0.05)² = 0.05 × 1.05). Picking the far side of it is always the
 * higher-contrast label, worst case 4.58:1 — enough for the 10px bar labels.
 */
const LABEL_LUMINANCE_PIVOT = 0.179;

/** WCAG relative luminance of a `#rgb` / `#rrggbb` string; null if unparseable. */
function hexLuminance(hex: string): number | null {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Segment colours are picked by the user, so stamping white text on them was a
 * guaranteed contrast failure for any pale choice — white on #fbbf24 is 1.7:1.
 * Derive the label colour from the swatch instead, and fall back to the theme
 * pair when the stored colour is missing or malformed so the row still renders.
 *
 * Pure #000/#fff rather than the theme's near-black/near-white: softening
 * either end drops the worst case from 4.58:1 to about 4.1:1, under AA.
 */
const FALLBACK_SWATCH = { bg: "var(--primary)", fg: "var(--primary-foreground)" };

function segmentSwatch(color: string | null | undefined): { bg: string; fg: string } {
  if (typeof color !== "string") return FALLBACK_SWATCH;
  const luminance = hexLuminance(color);
  if (luminance == null) return FALLBACK_SWATCH;
  return { bg: color, fg: luminance > LABEL_LUMINANCE_PIVOT ? "#000000" : "#ffffff" };
}

function bucketLabel(key: string, tr: (da: string, en: string) => string): string {
  switch (key) {
    case "expired":
      return tr("Udløbet", "Expired");
    case "d30":
      return tr("≤ 30 dage", "≤ 30 days");
    case "d60":
      return tr("31–60 dage", "31–60 days");
    case "d90":
      return tr("61–90 dage", "61–90 days");
    case "later":
      return tr("Senere", "Later");
    case "none":
      return tr("Ingen dato", "No date");
    default:
      return key;
  }
}

export default function ReportsPage() {
  const { locale } = useLanguage();
  const { isPersonal } = useWorkspaces();
  const tr = (da: string, en: string) => (locale === "da" ? da : en);

  const {
    data: expiry,
    isLoading: loadingExpiry,
    isError: expiryError,
    error: expiryErr,
    refetch: refetchExpiry,
  } = useContractExpiryReport();
  const {
    data: segData,
    isLoading: loadingSeg,
    isError: segError,
    error: segErr,
    refetch: refetchSeg,
  } = useSegmentsReport();

  const totals = expiry?.totals;
  const chartData = (expiry?.buckets ?? []).map((b) => ({
    key: b.key,
    name: bucketLabel(b.key, tr),
    count: b.count,
  }));
  const segments = segData?.segments ?? [];
  const maxSegValue = Math.max(1, ...segments.map((s) => s.contractValue));

  // This page's data is NOT NULL organization-scoped, so in the personal
  // workspace the API refuses it. Returning here — before any data-dependent
  // branch — is what stops a refusal being rendered as "nothing here yet",
  // which reads as a fact about the business rather than about the workspace.
  if (isPersonal) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <RequiresOrganization feature={locale === "da" ? "Rapporter" : "Reports"} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {tr("Rapporter", "Reports")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              "Kontraktudløb og partnersegmenter for din organisation.",
              "Contract renewals and partner segments for your organization."
            )}
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi
            icon={FileText}
            label={tr("Kontrakter", "Contracts")}
            value={formatNumber(totals?.count ?? 0, locale)}
            tint="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          />
          <Kpi
            icon={ShieldCheck}
            label={tr("Aktive", "Active")}
            value={formatNumber(totals?.active ?? 0, locale)}
            tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          />
          <Kpi
            icon={AlarmClock}
            label={tr("Udløber ≤ 30 dage", "Expiring ≤ 30 days")}
            value={formatNumber(totals?.expiringSoon ?? 0, locale)}
            tint="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          />
          <Kpi
            icon={Coins}
            label={tr("Samlet værdi", "Total value")}
            value={formatOre(totals?.value ?? 0, locale)}
            tint="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          />
        </div>

        {/* Contract expiry chart */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <AlarmClock className="size-4 text-primary" />
              {tr("Kontraktudløb", "Contract expiry")}
            </h2>
            {loadingExpiry ? (
              <div className="h-[240px] animate-pulse bg-muted/50 rounded-lg" />
            ) : expiryError ? (
              // Without this branch a failed request fell through to the empty
              // state and told the user there were no contracts.
              <QueryError error={expiryErr} onRetry={() => refetchExpiry()} />
            ) : chartData.every((d) => d.count === 0) ? (
              <p className="text-sm text-muted-foreground py-16 text-center">
                {tr("Ingen kontrakter at vise.", "No contracts to show.")}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  {/*
                    Axis ticks and the hover cursor are themed with Tailwind
                    classes, not `fill` values. Recharts spreads `tick` onto the
                    SVG <text> as a presentation attribute, and `var()` inside a
                    presentation attribute is still only partially implemented
                    (Chromium); a class produces a real CSS declaration, which
                    resolves everywhere and re-resolves on theme switch with no
                    listener. The tooltip, by contrast, is a plain <div> styled
                    inline, so `var()` works there directly.
                  */}
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, className: "fill-muted-foreground" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, className: "fill-muted-foreground" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ className: "fill-muted-foreground/10", stroke: "none" }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      // Recharts hardcodes a white background and #ccc border,
                      // so both have to be overridden, not merely supplemented.
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      color: "var(--popover-foreground)",
                    }}
                    // The bar takes its fill from <Cell>, so the tooltip entry
                    // has no colour of its own and recharts defaults it to #000.
                    itemStyle={{ color: "var(--popover-foreground)" }}
                  />
                  <Bar
                    dataKey="count"
                    name={tr("Kontrakter", "Contracts")}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  >
                    {chartData.map((d) => (
                      <Cell key={d.key} fill={BUCKET_COLOR[d.key] ?? BUCKET_COLOR.none} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Segments */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              {tr("Segmenter", "Segments")}
            </h2>
            {loadingSeg ? (
              <div className="h-24 animate-pulse bg-muted/50 rounded-lg" />
            ) : segError ? (
              <QueryError error={segErr} onRetry={() => refetchSeg()} />
            ) : segments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {tr(
                  "Ingen segmenter endnu. Opret dem fra en virksomhedsprofil.",
                  "No segments yet. Create them from a company profile."
                )}
              </p>
            ) : (
              <div className="space-y-3">
                {segments.map((s) => {
                  const swatch = segmentSwatch(s.color);
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <div className="w-32 shrink-0 flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: swatch.bg }}
                        />
                        <span className="text-sm font-medium text-foreground truncate">
                          {s.name}
                        </span>
                      </div>
                      <div className="flex-1 h-6 rounded-md bg-muted/40 overflow-hidden">
                        <div
                          className="h-full rounded-md flex items-center justify-end px-2"
                          style={{
                            width: `${Math.max(6, (s.contractValue / maxSegValue) * 100)}%`,
                            backgroundColor: swatch.bg,
                          }}
                        >
                          <span
                            className="text-[10px] font-semibold whitespace-nowrap"
                            style={{ color: swatch.fg }}
                          >
                            {formatOre(s.contractValue, locale)}
                          </span>
                        </div>
                      </div>
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {formatNumber(s.companyCount, locale)}{" "}
                        {tr("virks.", "cos.")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <Card className="border-0 shadow-sm py-0">
      <CardContent className="p-4 sm:p-5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${tint}`}>
          <Icon className="size-5" />
        </div>
        <p className="text-2xl font-black text-foreground tabular-nums tracking-tight">
          {value}
        </p>
        <p className="text-xs text-muted-foreground font-medium mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
