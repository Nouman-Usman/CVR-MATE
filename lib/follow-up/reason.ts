import { da, en } from "@/lib/i18n";

import type { FollowUpReason } from "./types";

/**
 * Render a reason for display.
 *
 * The API returns `{ key, params }` rather than a sentence so one queue payload
 * can render Danish on screen and the recipient's own language in the digest
 * email. Formatting server-side would force a choice and be wrong for one of
 * them.
 *
 * Client-safe: `lib/follow-up/types.ts` and `lib/follow-up/keys.ts` carry no
 * `server-only` marker precisely so this can be shared.
 */
export function formatReason(reason: FollowUpReason, locale: string): string {
  const dict = locale === "da" ? da : en;
  const table = dict.followUps.reasons as Record<string, string>;
  const template = table[reason.key];
  // An unknown key means a signal shipped without its string. Showing the raw
  // key is ugly but truthful; an empty card would hide real work.
  if (!template) return reason.key;

  return Object.entries(reason.params).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
    template
  );
}
