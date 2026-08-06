"use client";

import { useState } from "react";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { formatDate } from "@/lib/format";
import { useCompanyNotes, useCreateNote } from "@/lib/hooks/use-company-crm";
import { card, inputCls, panelCls, primaryBtn, sectionTitle } from "./shared";

export function NotesSection({ vat }: { vat: string }) {
  const { tr, locale } = useTr();
  const apiError = useApiErrorMessage();
  const { data, isLoading } = useCompanyNotes(vat);
  const createNote = useCreateNote(vat);
  const [content, setContent] = useState("");

  const notes = data?.notes ?? [];

  function add() {
    const v = content.trim();
    if (!v) return;
    createNote.mutate(v, {
      onSuccess: () => setContent(""),
      onError: (e) => toast.error(apiError(e)),
    });
  }

  return (
    <div className={card}>
      <h2 className={sectionTitle}>
        <StickyNote className="size-4 text-primary" />
        {tr("Noter", "Notes")}
      </h2>
      <div className="mb-4">
        <textarea
          className={inputCls + " resize-none"}
          rows={2}
          // Single field under a visible section heading — a repeated visible
          // label would be noise, but the field still needs a name.
          aria-label={tr("Ny note", "New note")}
          placeholder={tr("Tilføj en note…", "Add a note…")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={add}
            disabled={createNote.isPending || !content.trim()}
            className={primaryBtn}
          >
            {tr("Tilføj note", "Add note")}
          </button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {tr("Indlæser…", "Loading…")}
        </p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {tr("Ingen noter endnu.", "No notes yet.")}
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className={panelCls}>
              <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {n.author?.name ?? tr("Ukendt", "Unknown")} · {formatDate(n.createdAt, locale)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
