import "server-only";

import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash";

/**
 * The single auth check for scheduled endpoints.
 *
 * Was duplicated verbatim across cron routes, which meant two independent copies
 * of the same two weaknesses:
 *   - the bearer comparison was `===`, i.e. not constant time,
 *   - a missing secret and a wrong secret took different paths.
 *
 * Returns false whenever nothing is configured — a cron endpoint with no
 * configured auth must be closed, not open.
 */
export async function verifyCronRequest(req: NextRequest): Promise<boolean> {
  if (await verifyQStashRequest(req)) return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization");
  if (!header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  // Length differing is not secret; content is. Comparing unequal-length
  // buffers throws, so bail first.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
