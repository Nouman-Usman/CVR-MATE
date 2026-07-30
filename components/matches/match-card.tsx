"use client";

import Link from "next/link";
import { Building2, MapPin, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import { companyColors } from "@/lib/constants/colors";
import type { MatchItem } from "@/lib/hooks/use-match-feed";

// Converts "ANTAL_0_0" → "0", "ANTAL_1_4" → "1–4", "ANTAL_1000_" → "1000+"
function formatEmployeeCount(code: string): string {
  if (!code || code === "–") return "–";
  const m = code.match(/^ANTAL_(\d+)_(\d*)$/);
  if (!m) return code;
  const [, min, max] = m;
  if (!max) return `${min}+`;
  if (min === max) return min;
  return `${min}–${max}`;
}

function formatFoundedYear(founded: string): string {
  if (!founded) return "";
  const year = new Date(founded).getFullYear();
  return Number.isNaN(year) ? founded : String(year);
}

const scoreStyles: Record<MatchItem["score"], string> = {
  high: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10",
  low: "bg-slate-100 text-slate-500 ring-1 ring-slate-500/10",
};

export function MatchCard({ item, colorIndex = 0 }: { item: MatchItem; colorIndex?: number }) {
  const { t, locale } = useLanguage();
  const m = t.matches;

  const snapshot = item.companySnapshot;
  const name = snapshot?.name?.trim() || `CVR ${item.cvr}`;
  const color = companyColors[colorIndex % companyColors.length];
  const initials = name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const scoreLabel = m.score[item.score];
  const employees = snapshot?.employees ? formatEmployeeCount(snapshot.employees) : "";
  const foundedYear = snapshot?.founded ? formatFoundedYear(snapshot.founded) : "";

  const facts: { key: string; label?: string; value: string }[] = [];
  facts.push({ key: "cvr", value: item.cvr });
  if (snapshot?.city) facts.push({ key: "city", value: snapshot.city });
  if (foundedYear) facts.push({ key: "founded", label: m.founded, value: foundedYear });
  if (employees && employees !== "–") facts.push({ key: "employees", label: m.employees, value: employees });

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,74,198,0.06)] border border-border/40 overflow-hidden">
      <div className="p-6 sm:p-7">
        {/* Header — avatar, name, score */}
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
              color.bg
            )}
          >
            <span className={cn("text-sm font-bold", color.text)}>{initials}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/company/${item.cvr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground hover:text-blue-600 transition-colors leading-tight font-(family-name:--font-manrope)"
              >
                {name}
              </Link>
              <span
                className={cn(
                  "inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.06em]",
                  scoreStyles[item.score]
                )}
              >
                <Sparkles className="size-3" />
                {scoreLabel}
              </span>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-muted-foreground flex-wrap">
              {snapshot?.industry ? (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3.5 text-muted-foreground/50" />
                  {snapshot.industry}
                </span>
              ) : null}
              {snapshot?.city ? (
                <>
                  {snapshot?.industry && <span className="text-muted-foreground/30">·</span>}
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5 text-muted-foreground/50" />
                    {snapshot.city}
                  </span>
                </>
              ) : null}
              {snapshot?.form ? (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span>{snapshot.form}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Why this fits you */}
        <div className="mt-5 rounded-xl border border-border/50 bg-muted/30 p-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {m.whyFits}
          </p>
          <p className="text-sm leading-6 text-foreground/80">
            {item.reason?.trim() ||
              (locale === "da"
                ? "Matchet ud fra dine tidligere valg."
                : "Matched from your previous choices.")}
          </p>
        </div>

        {/* Facts row */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {facts.map((f) => (
            <div key={f.key} className="flex items-baseline gap-1.5 text-[12px]">
              {f.label && (
                <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground/60">
                  {f.label}
                </span>
              )}
              <span className="tabular-nums font-medium text-foreground/80">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
