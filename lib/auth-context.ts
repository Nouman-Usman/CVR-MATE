import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/db";
import { member } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type OrgRole = "owner" | "admin" | "manager" | "member" | "viewer";

export interface AuthContext {
  session: Awaited<ReturnType<typeof auth.api.getSession>> & {};
  userId: string;
  orgId: string;
  role: OrgRole;
}

/**
 * Get the user's role within the given organization.
 */
export async function getUserRole(
  userId: string,
  orgId: string
): Promise<OrgRole> {
  const row = await db.query.member.findFirst({
    where: and(eq(member.userId, userId), eq(member.organizationId, orgId)),
    columns: { role: true },
  });
  return (row?.role as OrgRole) ?? "viewer";
}

/**
 * Unified auth + org + permission context for API routes.
 *
 * Replaces the repetitive pattern of:
 *   const session = await auth.api.getSession(...)
 *   if (!session) return 401
 *   const userId = session.user.id
 *
 * With:
 *   const { userId, orgId, role } = await getAuthContext({ resource: 'todo', action: 'read' })
 *
 * Throws AuthError (caught by callers and returned as JSON responses).
 */
export async function getAuthContext(
  permission?: { resource: string; action: string }
): Promise<AuthContext> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new AuthError("Unauthorized", 401);
  }

  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    throw new AuthError("No active organization. Please select or create a workspace.", 400);
  }

  const role = await getUserRole(session.user.id, orgId);

  if (permission) {
    const { allowed } = await checkPermission(
      session.user.id,
      orgId,
      permission.resource,
      permission.action
    );
    if (!allowed) {
      throw new AuthError(
        `Insufficient permissions: ${permission.action} on ${permission.resource}`,
        403
      );
    }
  }

  return {
    session,
    userId: session.user.id,
    orgId,
    role,
  };
}

/**
 * Helper to convert AuthError to a NextResponse JSON response.
 * Use in API route catch blocks.
 */
export function handleAuthError(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json(
      { error: error.message },
      { status: error.status }
    );
  }
  throw error; // re-throw non-auth errors
}
