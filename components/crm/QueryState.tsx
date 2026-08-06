"use client";

import type { ReactNode } from "react";
import { AlertCircle, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";

/**
 * The three states every list must handle explicitly.
 *
 * The bug these replace: several CRM pages destructured only `data` and
 * `isLoading`, so a failed request fell through to the empty state and told the
 * user "no contracts to show" when the truth was "the request failed". An empty
 * state that can render on error is a lie, and the user has no way to know.
 */

/** Rows shaped like the real content, so the layout does not jump on load. */
export function ListSkeleton({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-border">
          <Skeleton className="size-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** A failed query, with the retry the user needs to recover without a reload. */
export function QueryError({
  error,
  onRetry,
  className = "",
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { tr } = useTr();
  const message = useApiErrorMessage()(error);

  return (
    <Card className={`border-0 shadow-sm bg-destructive/5 ${className}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertCircle className="size-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {tr("Kunne ikke indlæses", "Could not load")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{message}</p>
            </div>
          </div>
          {onRetry && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 shrink-0" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              {tr("Prøv igen", "Retry")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** A genuinely empty result — with a way forward, not just a shrug. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
        {icon ?? <SearchX className="size-6 text-muted-foreground" />}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Detail-page not-found / failure. Detail pages previously rendered
 * `isLoading || !data ? "Loading…"`, which shows a spinner forever on a 404.
 */
export function NotFoundState({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState icon={<SearchX className="size-6 text-muted-foreground" />} title={title} action={action} />
  );
}
