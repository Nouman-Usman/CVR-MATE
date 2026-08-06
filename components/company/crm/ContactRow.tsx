"use client";

import { Download, Pencil, Trash2 } from "lucide-react";
import type { Contact } from "@/lib/hooks/use-contacts";
import { iconBtn, type Tr } from "./shared";

export function ContactRow({
  contact: c,
  tr,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  tr: Tr;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = c.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="py-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
          {c.isPrimary && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {tr("Primær", "Primary")}
            </span>
          )}
        </div>
        {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
        <div className="mt-1 flex flex-col gap-0.5">
          {c.email && (
            <a href={`mailto:${c.email}`} className="text-xs text-primary hover:underline truncate">
              {c.email}
            </a>
          )}
          {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
          {c.linkedinUrl && (
            <a
              href={c.linkedinUrl.startsWith("http") ? c.linkedinUrl : `https://${c.linkedinUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline truncate"
            >
              LinkedIn
            </a>
          )}
          {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={`/api/contacts/${c.id}/export`}
          title={tr("Eksportér (GDPR)", "Export (GDPR)")}
          className={iconBtn}
        >
          <Download className="size-4" />
        </a>
        <button onClick={onEdit} title={tr("Rediger", "Edit")} className={iconBtn}>
          <Pencil className="size-4" />
        </button>
        <button
          onClick={onDelete}
          title={tr("Slet", "Delete")}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
