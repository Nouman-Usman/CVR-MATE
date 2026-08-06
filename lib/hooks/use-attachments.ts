"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, ApiError } from "@/lib/api/fetch-json";
import { qk } from "@/lib/hooks/query-keys";

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  /** Freshly signed per request; expires in ~60s, so never persist it. */
  url: string | null;
}

interface UploadTicket {
  attachment: Omit<Attachment, "url">;
  uploadUrl: string;
  token: string;
  path: string;
}

export function useAttachments(interactionId: string, enabled = true) {
  return useQuery<{ attachments: Attachment[] }>({
    queryKey: qk.attachments(interactionId),
    queryFn: () => fetchJson(`/api/interactions/${interactionId}/attachments`),
    enabled: enabled && !!interactionId,
    // The signed URLs in the payload expire in a minute, so caching the list
    // for longer than that would hand out dead links.
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

/**
 * Two-step upload: ask the server for a signed URL (which also records the
 * row), then PUT the bytes straight to storage.
 *
 * The file never passes through the Next.js server — a 25 MB body would hit the
 * serverless request limit, and proxying it would double the bandwidth for no
 * benefit.
 */
export function useUploadAttachment(interactionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const ticket = await fetchJson<UploadTicket>(
        `/api/interactions/${interactionId}/attachments`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        }
      );

      const res = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });

      if (!res.ok) {
        // The metadata row already exists at this point. Surfacing the failure
        // rather than swallowing it is what lets the user retry knowingly —
        // the orphaned row is visible in the list with a dead link.
        throw new ApiError(res.status, `Upload failed (${res.status})`);
      }

      return ticket.attachment;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.attachments(interactionId) }),
  });
}

export function useDeleteAttachment(interactionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/attachments/${id}`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.attachments(interactionId) }),
  });
}
