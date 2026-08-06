import "server-only";

import { Receiver } from "@upstash/qstash";

function createReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return null;
  return new Receiver({ currentSigningKey, nextSigningKey });
}

const receiver = createReceiver();

/**
 * Verify that a request was sent by QStash, for this specific endpoint.
 *
 * The `url` claim is the part that matters and was previously omitted. QStash
 * signs the destination URL along with the body, but a verify call that does not
 * pass the URL never checks it — so a signature captured from any scheduled job
 * under the same signing keys could be replayed against any other cron route.
 * With several jobs sharing one QStash project, that let a captured
 * `/api/cron/triggers` delivery drive `/api/cron/contract-renewals`.
 *
 * The forwarded host is preferred over `req.url`, which behind Vercel's proxy
 * reports the internal origin rather than the public URL QStash actually signed.
 */
export async function verifyQStashRequest(req: Request): Promise<boolean> {
  if (!receiver) return false;

  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;

  try {
    const body = await req.clone().text();
    const url = publicUrlOf(req);
    await receiver.verify(url ? { signature, body, url } : { signature, body });
    return true;
  } catch {
    return false;
  }
}

/** Reconstruct the externally visible URL from proxy headers. */
function publicUrlOf(req: Request): string | null {
  try {
    const parsed = new URL(req.url);
    const forwardedHost = req.headers.get("x-forwarded-host");
    if (!forwardedHost) return null;
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}
