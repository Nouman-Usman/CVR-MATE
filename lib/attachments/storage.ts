import "server-only";

import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Private object storage for CRM attachments.
 *
 * A separate bucket from `cvr-videos`: those are public marketing assets, these
 * are customer material belonging to one org. The bucket must be created as
 * **private** — with a public bucket every signed-URL precaution below is
 * decoration, because the raw object URL would be guessable and permanent.
 */
export const ATTACHMENT_BUCKET = "crm-attachments";

/** 25 MB. Large enough for a slide deck, small enough to survive a bad upload. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/**
 * Allow-list, not a block-list. A block-list has to anticipate every dangerous
 * type; this only has to name the ones the feature is for. `.svg` is
 * deliberately absent — it is an executable document in a browser context.
 */
export const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

let client: ReturnType<typeof createClient> | null = null;

/**
 * Lazily constructed so a deployment without Supabase credentials fails at the
 * one route that needs them, with a clear message, instead of crashing every
 * module that transitively imports this file.
 */
export function attachmentStorage() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Attachment storage is not configured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
      );
    }
    client = createClient(url, key);
  }
  return client.storage.from(ATTACHMENT_BUCKET);
}

/**
 * Build the object path. Generated entirely server-side from ids plus a random
 * uuid — the user's filename never reaches it.
 *
 * Two reasons: a client-supplied path containing `../` would write into another
 * org's prefix, and even a sanitised name would leak customer information into
 * a URL. The display name is kept in the database column instead.
 */
export function attachmentPath(
  organizationId: string,
  interactionId: string,
  contentType: string
): string {
  const ext = ALLOWED_CONTENT_TYPES[contentType] ?? "bin";
  return `org/${organizationId}/interaction/${interactionId}/${randomUUID()}.${ext}`;
}

/** Strips directory components and control characters from a display name. */
export function safeDisplayName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "file";
  // eslint-disable-next-line no-control-regex -- stripping control chars is the point
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "file").slice(0, 200);
}

/** Seconds a download link stays valid. Long enough to click, short enough to expire. */
export const DOWNLOAD_URL_TTL = 60;
