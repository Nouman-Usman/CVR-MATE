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
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatDKK, formatNumber } from "@/lib/format";
import { useContractExpiryReport, useSegmentsReport } from "@/lib/hooks/use-reports";

const BUCKET_COLOR: Record<string, string> = {
  expired: "#e11d48",
  d30: "#f59e0b",
  d60: "#eab308",
  d90: "#3b82f6",
  later: "#10b981",
  none: "#94a3b8",
};

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
  const tr = (da: string, en: string) => (locale === "da" ? da : en);

  const { data: expiry, isLoading: loadingExpiry } = useContractExpiryReport();
  const { data: segData, isLoading: loadingSeg } = useSegmentsReport();

  const totals = expiry?.totals;
  const chartData = (expiry?.buckets ?? []).map((b) => ({
    key: b.key,
    name: bucketLabel(b.key, tr),
    count: b.count,
  }));
  const segments = segData?.segments ?? [];
  const maxSegValue = Math.max(1, ...segments.map((s) => s.contractValue));

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
            tint="bg-blue-50 text-blue-600"
          />
          <Kpi
            icon={ShieldCheck}
            label={tr("Aktive", "Active")}
            value={formatNumber(totals?.active ?? 0, locale)}
            tint="bg-emerald-50 text-emerald-600"
          />
          <Kpi
            icon={AlarmClock}
            label={tr("Udløber ≤ 30 dage", "Expiring ≤ 30 days")}
            value={formatNumber(totals?.expiringSoon ?? 0, locale)}
            tint="bg-amber-50 text-amber-600"
          />
          <Kpi
            icon={Coins}
            label={tr("Samlet værdi", "Total value")}
            value={formatDKK(totals?.value ?? 0, locale)}
            tint="bg-violet-50 text-violet-600"
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
            ) : chartData.every((d) => d.count === 0) ? (
              <p className="text-sm text-muted-foreground py-16 text-center">
                {tr("Ingen kontrakter at vise.", "No contracts to show.")}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(100,116,139,0.08)" }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {chartData.map((d) => (
                      <Cell key={d.key} fill={BUCKET_COLOR[d.key] ?? "#94a3b8"} />
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
            ) : segments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {tr(
                  "Ingen segmenter endnu. Opret dem fra en virksomhedsprofil.",
                  "No segments yet. Create them from a company profile."
                )}
              </p>
            ) : (
              <div className="space-y-3">
                {segments.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
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
                          backgroundColor: s.color,
                        }}
                      >
                        <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                          {formatDKK(s.contractValue, locale)}
                        </span>
                      </div>
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                      {formatNumber(s.companyCount, locale)}{" "}
                      {tr("virks.", "cos.")}
                    </span>
                  </div>
                ))}
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
