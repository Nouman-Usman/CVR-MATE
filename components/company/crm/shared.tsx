"use client";

import type { ReactNode } from "react";
import {
  Mail,
  MapPin,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Tr = (da: string, en: string) => string;

export const card = "bg-card rounded-2xl shadow-sm border border-border p-5 sm:p-6";

export const sectionTitle = "text-sm font-bold text-foreground mb-4 flex items-center gap-2";

export const inputCls =
  "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring";

/** Inline panel that holds a section's create/edit form. */
export const panelCls = "p-3 rounded-lg bg-muted/50 border border-border";

export const primaryBtn =
  "px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer";

export const subtleBtn =
  "px-4 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/70 cursor-pointer";

export const iconBtn =
  "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer";

/** Delete affordance that only appears while its row is hovered. */
export const rowDeleteBtn =
  "opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer shrink-0";

export function SectionHeader({
  icon: Icon,
  title,
  count,
  action,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className={sectionTitle + " mb-0"}>
        <Icon className="size-4 text-primary" />
        {title}
        {count != null && count > 0 && (
          <span className="text-xs font-semibold text-muted-foreground">({count})</span>
        )}
      </h2>
      {action}
    </div>
  );
}

/**
 * Interaction-type vocabulary. Shared with the /interactions feed, which had an
 * identical private copy — two maps meant a new type could render in one place
 * and fall back to a generic icon in the other.
 */
export const TYPE_ICON: Record<string, LucideIcon> = {
  meeting: Users,
  visit: MapPin,
  call: Phone,
  email: Mail,
  note: StickyNote,
};

export function typeLabel(type: string, tr: Tr): string {
  switch (type) {
    case "meeting":
      return tr("Møde", "Meeting");
    case "visit":
      return tr("Besøg", "Visit");
    case "call":
      return tr("Opkald", "Call");
    case "email":
      return tr("E-mail", "Email");
    case "note":
      return tr("Notat", "Note");
    default:
      return type;
  }
}
