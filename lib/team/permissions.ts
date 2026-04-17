import "server-only";

import { db } from "@/db";
import { member, invitation, organization } from "@/db/auth-schema";
import { subscription } from "@/db/app-schema";
import { eq, and, count, or, gt } from "drizzle-orm";
import { PLAN_LIMITS, priceToPlan, type PlanId } from "@/lib/stripe/plans";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TeamAction =
  | "invite_member"
  | "remove_member"
  | "change_role"
  | "cancel_invitation"
  | "delete_org"
  | "rename_org"
  | "transfer_ownership";

export type OrgRole = "owner" | "admin" | "member";

export interface OrgMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  createdAt: Date;
}

// ─── Role Hierarchy ─────────────────────────────────────────────────────────

const ROLE_RANK: Record<OrgRole, number> = { owner: 3, admin: 2, member: 1 };

const ACTION_MIN_ROLE: Record<TeamAction, OrgRole[]> = {
  invite_member: ["owner", "admin"],
  remove_member: ["owner", "admin"],
  change_role: ["owner"],
  cancel_invitation: ["owner", "admin"],
  delete_org: ["owner"],
  rename_org: ["owner", "admin"],
  transfer_ownership: ["owner"],
};

// ─── Core Permission Functions ──────────────────────────────────────────────

/**
 * Get a user's membership in an organization. Always queries the DB — never
 * trusts cached session state.
 */
export async function getOrgMembership(
  userId: string,
  orgId: string
): Promise<OrgMembership | null> {
  const row = await db.query.member.findFirst({
    where: and(eq(member.userId, userId), eq(member.organizationId, orgId)),
  });
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    role: row.role as OrgRole,
    createdAt: row.createdAt,
  };
}

/**
 * Validate that activeOrganizationId from session is still legitimate.
 * Returns the orgId if valid, null if the user is no longer a member.
 */
export async function validateActiveOrg(
  userId: string,
  activeOrgId: string | null | undefined
): Promise<string | null> {
  if (!activeOrgId) return null;
  const membership = await getOrgMembership(userId, activeOrgId);
  return membership ? activeOrgId : null;
}

/**
 * Assert the user is a member of the org. Throws NOT_MEMBER if not.
 */
export async function assertUserIsMemberOfOrg(
  userId: string,
  orgId: string
): Promise<OrgMembership> {
  const membership = await getOrgMembership(userId, orgId);
  if (!membership) {
    throw new TeamPermissionError("NOT_MEMBER", "You are not a member of this organization");
  }
  return membership;
}

/**
 * Assert the user has permission to perform a team action.
 * Returns the user's membership on success.
 */
export async function assertPermission(
  userId: string,
  orgId: string,
  action: TeamAction
): Promise<OrgMembership> {
  const membership = await assertUserIsMemberOfOrg(userId, orgId);
  const allowedRoles = ACTION_MIN_ROLE[action];

  if (!allowedRoles.includes(membership.role)) {
    throw new TeamPermissionError(
      "INSUFFICIENT_PERMISSIONS",
      `Role "${membership.role}" cannot perform "${action}"`
    );
  }

  return membership;
}

/**
 * Assert that the actor can act on a target member. The actor's role rank
 * must be strictly higher than the target's.
 */
export function assertCanActOnMember(
  actorRole: OrgRole,
  targetRole: OrgRole
): void {
  const actorRank = ROLE_RANK[actorRole] ?? 0;
  const targetRank = ROLE_RANK[targetRole] ?? 0;
  if (actorRank <= targetRank) {
    throw new TeamPermissionError(
      "CANNOT_ACT_ON_HIGHER_ROLE",
      `Role "${actorRole}" cannot act on role "${targetRole}"`
    );
  }
}

// ─── Seat Enforcement ───────────────────────────────────────────────────────

/**
 * Get the plan's team member limit for the org creator.
 *
 * Looks up the subscription of the org owner (the user who pays), not the
 * inviter (who may be an admin). Seat entitlements are always tied to the
 * billing account.
 */
async function getOrgOwnerPlanLimit(orgId: string): Promise<number> {
  // Find the owner of the organization
  const ownerMember = await db.query.member.findFirst({
    where: and(eq(member.organizationId, orgId), eq(member.role, "owner")),
  });

  if (!ownerMember) return 0;

  // Get the owner's subscription
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, ownerMember.userId),
  });

  if (!sub || sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete") {
    return PLAN_LIMITS.free.teamMemberLimit;
  }

  const plan: PlanId = sub.stripePriceId ? priceToPlan(sub.stripePriceId) : "free";
  return PLAN_LIMITS[plan].teamMemberLimit;
}

/**
 * Assert there are available seats in the organization.
 *
 * This function is designed to be called inside a serializable transaction
 * to prevent race conditions. The caller must provide the tx handle.
 *
 * Counts: active members + pending (non-expired) invitations.
 */
export async function assertSeatAvailable(
  orgId: string,
  tx?: typeof db
): Promise<void> {
  const dbCtx = tx ?? db;
  const limit = await getOrgOwnerPlanLimit(orgId);

  // -1 = unlimited
  if (limit === -1) return;

  // Count active members
  const memberRows = await dbCtx
    .select({ value: count() })
    .from(member)
    .where(eq(member.organizationId, orgId));
  const memberCount = memberRows[0]?.value ?? 0;

  // Count pending (non-expired) invitations
  const inviteRows = await dbCtx
    .select({ value: count() })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, orgId),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date())
      )
    );
  const inviteCount = inviteRows[0]?.value ?? 0;

  const totalSeats = memberCount + inviteCount;

  if (totalSeats >= limit) {
    throw new TeamPermissionError(
      "SEAT_LIMIT_REACHED",
      `Organization has reached its seat limit (${limit}). Upgrade to add more members.`
    );
  }
}

/**
 * Check if a user's plan allows creating organizations.
 */
export async function assertCanCreateOrg(userId: string): Promise<void> {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  let plan: PlanId = "free";
  if (sub && sub.status !== "canceled" && sub.status !== "unpaid" && sub.status !== "incomplete") {
    plan = sub.stripePriceId ? priceToPlan(sub.stripePriceId) : "free";
  }

  if (!PLAN_LIMITS[plan].teamFeatures) {
    throw new TeamPermissionError(
      "PLAN_NOT_ALLOWED",
      "Team features require the Enterprise plan. Please upgrade."
    );
  }
}

// ─── Resource-Level Authorization ───────────────────────────────────────────

/**
 * Check if a user can mutate a team-scoped resource.
 *
 * Rules:
 * - Personal resource (organizationId=null): only creator can mutate
 * - Team resource: owner/admin can always mutate; member only if they created it
 */
export async function assertCanMutateResource(
  userId: string,
  resource: { userId: string; organizationId: string | null }
): Promise<void> {
  if (!resource.organizationId) {
    // Personal resource — only creator
    if (resource.userId !== userId) {
      throw new TeamPermissionError("FORBIDDEN", "You can only modify your own resources");
    }
    return;
  }

  // Team resource — check membership and role
  const membership = await getOrgMembership(userId, resource.organizationId);
  if (!membership) {
    throw new TeamPermissionError("NOT_MEMBER", "You are not a member of this organization");
  }

  const isAdminOrOwner = membership.role === "owner" || membership.role === "admin";
  const isCreator = resource.userId === userId;

  if (!isAdminOrOwner && !isCreator) {
    throw new TeamPermissionError(
      "FORBIDDEN",
      "Only admins or the resource creator can modify team resources"
    );
  }
}

// ─── Error Class ────────────────────────────────────────────────────────────

export type TeamErrorCode =
  | "NOT_MEMBER"
  | "INSUFFICIENT_PERMISSIONS"
  | "CANNOT_ACT_ON_HIGHER_ROLE"
  | "SEAT_LIMIT_REACHED"
  | "PLAN_NOT_ALLOWED"
  | "FORBIDDEN";

export class TeamPermissionError extends Error {
  public readonly code: TeamErrorCode;

  constructor(code: TeamErrorCode, message: string) {
    super(message);
    this.name = "TeamPermissionError";
    this.code = code;
  }
}

// ─── HTTP Response Helper ───────────────────────────────────────────────────

/**
 * Map a TeamPermissionError to an HTTP status code.
 */
export function teamErrorToStatus(err: TeamPermissionError): number {
  switch (err.code) {
    case "NOT_MEMBER":
    case "FORBIDDEN":
      return 403;
    case "INSUFFICIENT_PERMISSIONS":
    case "CANNOT_ACT_ON_HIGHER_ROLE":
      return 403;
    case "SEAT_LIMIT_REACHED":
      return 409;
    case "PLAN_NOT_ALLOWED":
      return 403;
    default:
      return 500;
  }
}
