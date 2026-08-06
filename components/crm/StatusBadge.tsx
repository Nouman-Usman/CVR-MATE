"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import { statusClassName, statusLabel, type StatusKind } from "@/lib/crm/status";

/**
 * The one status pill. Replaces four copy-pasted style maps and, more
 * importantly, stops rendering raw English enum values to Danish users.
 */
export function StatusBadge({
  kind,
  status,
  className = "",
}: {
  kind: StatusKind;
  status: string;
  className?: string;
}) {
  const { locale } = useLanguage();

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${statusClassName(
        kind,
        status
      )} ${className}`}
    >
      {statusLabel(kind, status, locale)}
    </span>
  );
}
