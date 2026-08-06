"use client";

import {
  ArrowLeftRight,
  Circle,
  Download,
  History,
  Pencil,
  PlusCircle,
  Trash2,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTr } from "@/lib/i18n/tr";
import { formatDate } from "@/lib/format";
import { useCompanyActivity, type ActivityItem } from "@/lib/hooks/use-company-crm";
import { card, sectionTitle, type Tr } from "./shared";

const ACTION_ICON: Record<string, LucideIcon> = {
  created: PlusCircle,
  updated: Pencil,
  deleted: Trash2,
  exported: Download,
  stage_changed: ArrowLeftRight,
  won: Trophy,
  lost: XCircle,
};

function activityLabel(a: ActivityItem, tr: Tr): string {
  const entity =
    a.entityType === "contact"
      ? tr("kontakt", "contact")
      : a.entityType === "note"
        ? tr("note", "note")
        : a.entityType === "deal"
          ? tr("aftale", "deal")
          : a.entityType === "interaction"
            ? tr("interaktion", "interaction")
            : a.entityType;
  const verb =
    a.action === "created"
      ? tr("oprettede", "created")
      : a.action === "updated"
        ? tr("opdaterede", "updated")
        : a.action === "deleted"
          ? tr("slettede", "deleted")
          : a.action === "exported"
            ? tr("eksporterede", "exported")
            : a.action === "stage_changed"
              ? tr("flyttede", "moved")
              : a.action === "won"
                ? tr("vandt", "won")
                : a.action === "lost"
                  ? tr("tabte", "lost")
                  : a.action;
  return `${verb} ${entity}`;
}

export function ActivitySection({ vat }: { vat: string }) {
  const { tr, locale } = useTr();
  const { data, isLoading } = useCompanyActivity(vat);
  const items = data?.activity ?? [];

  return (
    <div className={card + " lg:sticky lg:top-6"}>
      <h2 className={sectionTitle}>
        <History className="size-4 text-primary" />
        {tr("Aktivitet", "Activity")}
      </h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {tr("Indlæser…", "Loading…")}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {tr("Ingen aktivitet endnu.", "No activity yet.")}
        </p>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-4">
          {items.map((a) => {
            const Icon = ACTION_ICON[a.action] ?? Circle;
            return (
              <li key={a.id} className="ml-4">
                <span className="absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 ring-4 ring-card">
                  <Icon className="size-2.5 text-primary" />
                </span>
                <p className="text-xs text-foreground">
                  <span className="font-semibold">{a.actor?.name ?? tr("System", "System")}</span>{" "}
                  {activityLabel(a, tr)}
                  {typeof a.metadata?.name === "string" ? ` · ${a.metadata.name}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatDate(a.createdAt, locale)}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
