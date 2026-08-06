"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Trash2, Loader2, Download } from "lucide-react";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { useConfirm } from "@/components/crm/ConfirmDialog";
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from "@/lib/hooks/use-attachments";
import { rowDeleteBtn } from "./shared";

const MAX_MB = 25;

/** Human file size. Binary units, matching what the OS file dialog reports. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Files attached to one interaction — the "materials provided" deferred in P3.
 *
 * Loaded lazily: the timeline can hold dozens of interactions, and each list
 * request mints signed storage URLs, so fetching them all upfront would be a
 * burst of pointless signing work for files nobody opened.
 */
export function Attachments({
  interactionId,
  canEdit = true,
}: {
  interactionId: string;
  canEdit?: boolean;
}) {
  const { tr } = useTr();
  const apiError = useApiErrorMessage();
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useAttachments(interactionId, expanded);
  const upload = useUploadAttachment(interactionId);
  const remove = useDeleteAttachment(interactionId);

  const items = data?.attachments ?? [];

  function pick(file: File | undefined) {
    if (!file) return;
    // Checked here as well as server-side: rejecting a 200 MB file before the
    // upload starts is the difference between instant feedback and a minute of
    // wasted bandwidth ending in a 400.
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(
        tr(`Filen er for stor (maks. ${MAX_MB} MB).`, `File is too large (max ${MAX_MB} MB).`)
      );
      return;
    }
    upload.mutate(file, {
      onError: (e) => toast.error(apiError(e)),
      onSuccess: () => toast.success(tr("Fil vedhæftet", "File attached")),
    });
  }

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
        aria-expanded={expanded}
      >
        <Paperclip className="size-3" />
        {expanded ? tr("Skjul filer", "Hide files") : tr("Filer", "Files")}
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-1">
          {isLoading ? (
            <p className="text-[11px] text-muted-foreground">{tr("Indlæser…", "Loading…")}</p>
          ) : items.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {tr("Ingen filer endnu.", "No files yet.")}
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((a) => (
                <li key={a.id} className="group flex items-center gap-2">
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={a.filename}
                      className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline min-w-0"
                    >
                      <Download className="size-3 shrink-0" />
                      <span className="truncate">{a.filename}</span>
                    </a>
                  ) : (
                    // The row still renders when signing failed, so the file is
                    // visible (and deletable) rather than silently missing.
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                      <Download className="size-3 shrink-0 opacity-40" />
                      <span className="truncate">{a.filename}</span>
                      <span className="shrink-0">({tr("link utilgængeligt", "link unavailable")})</span>
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatSize(a.sizeBytes)}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() =>
                        confirm.ask({
                          title: tr("Slet denne fil?", "Delete this file?"),
                          name: a.filename,
                          description: tr(
                            "Filen fjernes permanent fra lageret.",
                            "The file is permanently removed from storage."
                          ),
                          onConfirm: () =>
                            remove.mutate(a.id, { onError: (e) => toast.error(apiError(e)) }),
                        })
                      }
                      className={rowDeleteBtn + " ml-auto"}
                      aria-label={tr(`Slet ${a.filename}`, `Delete ${a.filename}`)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  // Reset so re-picking the same file fires change again.
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50 cursor-pointer"
              >
                {upload.isPending ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    {tr("Uploader…", "Uploading…")}
                  </>
                ) : (
                  <>
                    <Paperclip className="size-3" />
                    {tr("Vedhæft fil", "Attach file")}
                  </>
                )}
              </button>
            </>
          )}

          {confirm.dialog}
        </div>
      )}
    </div>
  );
}
