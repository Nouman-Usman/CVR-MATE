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
 * Verify that a request was sent by QStash.
 * Returns true if the signature is valid, false otherwise.
 */
export async function verifyQStashRequest(req: Request): Promise<boolean> {
  if (!receiver) return false;

  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;

  try {
    const body = await req.clone().text();
    await receiver.verify({ signature, body });
    return true;
  } catch {
    return false;
  }
}
