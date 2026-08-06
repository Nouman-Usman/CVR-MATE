"use client";

import Link from "next/link";
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatOre } from "@/lib/format";
import { trendOf, type MetricDef } from "@/lib/dashboard/metrics";

/**
 * One dashboard metric.
 *
 * Money is INTEGER ØRE end to end, so currency metrics go through `formatOre` —
 * dividing by 100 here would be a second, drifting implementation of the money
 * rule the whole codebase already settled.
 */
export function StatCard({
  metric,
  value,
  previous,
  isLoading,
  locale,
}: {
  metric: MetricDef;
  value: number | undefined;
  previous: number | undefined;
  isLoading: boolean;
  locale: string;
}) {
  const Icon = metric.icon;
  const trend = value === undefined ? null : trendOf(value, previous);

  // A rise in "expiring soon" is bad news; the arrow direction still follows the
  // number, but the colour follows whether it is good.
  const isGood = trend === null ? false : metric.inverse ? trend < 0 : trend > 0;

  const display =
    value === undefined
      ? "–"
      : metric.format === "currency"
        ? formatOre(value, locale)
        : new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-GB").format(value);

  return (
    <Link href={metric.href} className="group block">
      <Card className="relative h-full overflow-hidden border-border/60 py-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
        <CardContent className="relative p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                metric.accent
              )}
            >
              <Icon className="size-5" />
            </span>
            <ArrowUpRight className="size-4 text-transparent transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
          </div>

          {isLoading ? (
            <Skeleton className="mb-1 h-9 w-24" />
          ) : (
            <p
              className={cn(
                "font-[family-name:var(--font-manrope)] font-black tracking-tight text-foreground tabular-nums",
                // Currency strings are far longer than counts; shrinking them
                // keeps "DKK 1.234.567,00" on one line instead of wrapping.
                metric.format === "currency" ? "text-xl sm:text-2xl" : "text-3xl"
              )}
            >
              {display}
            </p>
          )}

          <div className="mt-1 flex items-center gap-2">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {locale === "da" ? metric.label[0] : metric.label[1]}
            </p>
            {!isLoading && trend !== null && trend !== 0 && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  isGood
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}
              >
                {trend > 0 ? (
                  <TrendingUp className="size-2.5" />
                ) : (
                  <TrendingDown className="size-2.5" />
                )}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
