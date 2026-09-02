export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  assertUserIsMemberOfOrg,
  TeamPermissionError,
  teamErrorToStatus,
} from "@/lib/team/permissions";
import { logOrgEvent } from "@/lib/team/audit";
import { removeMemberFromOrg } from "@/lib/team/detach-member";
import { getTeamSession, unauthorized, badRequest } from "@/lib/team/session";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation/crm";
import { leaveOrgSchema } from "@/lib/validation/team";

/**
 * POST /api/team/leave — Leave an organization.
 *
 * Owners cannot leave (must transfer ownership first).
 *
 * The departure itself — deactivating the member's org-scoped triggers,
 * releasing their assignments and clearing their active workspace — is shared
 * with member removal via `removeMemberFromOrg`, so both exits behave the same.
 */
export async function POST(req: NextRequest) {
  const session = await getTeamSession(req);
  if (!session) return unauthorized();

  const rl = await checkRateLimit(session.user.id, "team_leave", 10, 3600);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  const parsed = parseBody(leaveOrgSchema, await req.json().catch(() => ({})));
  if (!parsed.ok) return badRequest(parsed.error);
  const { organizationId } = parsed.data;

  // Verify membership
  let membership;
  try {
    membership = await assertUserIsMemberOfOrg(session.user.id, organizationId);
  } catch (err) {
    if (err instanceof TeamPermissionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: teamErrorToStatus(err) });
    }
    throw err;
  }

  // Owners cannot leave — must transfer ownership first
  if (membership.role === "owner") {
    return badRequest("Owners cannot leave. Transfer ownership first.");
  }

  const detached = await removeMemberFromOrg(session.user.id, organizationId, membership.id);

  await logOrgEvent({
    organizationId,
    actorId: session.user.id,
    action: "member_left",
    targetUserId: session.user.id,
    metadata: { role: membership.role, ...detached },
  });

  return NextResponse.json({ ok: true });
}
