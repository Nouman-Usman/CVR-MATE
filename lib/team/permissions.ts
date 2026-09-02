import "server-only";

import { db } from "@/db";
import { member, invitation } from "@/db/auth-schema";
import { subscription } from "@/db/app-schema";
import { eq, and, count, gt, sql } from "drizzle-orm";
import { PLAN_LIMITS, priceToPlan, type PlanId } from "@/lib/stripe/plans";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TeamAction =
  | "invite_member"
  | "remove_member"
  | "change_role"
  | "cancel_invitation"
  | "delete_org"
  | "rename_org"
  | "transfer_ownership"
  // Connecting the organization's bookkeeping system. Separate from CRM
  // connections: this one reaches the financial records that invoices are
  // issued from.
  | "manage_integrations";

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
  // Owner/admin, matching invite_member — a plain member should not be able to
  // point the company's invoicing at an account of their choosing.
  manage_integrations: ["owner", "admin"],
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
 * Validate the user's active organization. Returns the org id, or null for the
 * personal workspace.
 *
 * It used to auto-discover — when the session named no organization it took the
 * user's oldest membership. That is how accepting an invitation moved someone
 * into org context without choosing it: with no switcher, a user with their own
 * plan and their own data was silently placed in an org, their personal rows
 * (organization_id IS NULL) stopped matching org-scoped queries, and everything
 * they saved afterwards became org property.
 *
 * Null now means personal, and personal is somewhere you can deliberately be
 * rather than a gap the system fills in. See lib/workspace/resolve.ts, which
 * expresses the same rule as a typed workspace; this remains for the callers
 * that only need the id.
 */
export async function validateActiveOrg(
  userId: string,
  activeOrgId: string | null | undefined
): Promise<string | null> {
  if (!activeOrgId) return null;

  // Never trust the session alone — membership is re-read every request, so a
  // removal or demotion takes effect immediately.
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
async function getOrgOwnerPlanLimit(orgId: string, dbCtx: SeatDb = db): Promise<number> {
  // Reads go through the caller's transaction, or the seat count and the plan
  // it is compared against could come from two different points in time.
  const [ownerMember] = await dbCtx
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.role, "owner")))
    .limit(1);

  if (!ownerMember) return 0;

  const [sub] = await dbCtx
    .select({ status: subscription.status, stripePriceId: subscription.stripePriceId })
    .from(subscription)
    .where(eq(subscription.userId, ownerMember.userId))
    .limit(1);

  if (!sub || sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete") {
    return PLAN_LIMITS.free.teamMemberLimit;
  }

  const plan: PlanId = sub.stripePriceId ? priceToPlan(sub.stripePriceId) : "free";
  return PLAN_LIMITS[plan].teamMemberLimit;
}

/** A transaction handle, or the pool itself. */
export type SeatDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Assert there are available seats in the organization.
 *
 * Counts active members plus pending, non-expired invitations — a sent
 * invitation reserves its seat, or an org could invite past its limit and only
 * discover it when everyone accepted.
 *
 * MUST be called inside the same transaction as the write it guards. Counting
 * and then inserting is the same shape as the duplicate-invite check further
 * down the invite route: a SELECT cannot be enforcement, because two concurrent
 * requests both read the pre-insert count and both proceed. The advisory lock
 * below is what makes it one: it is held for the rest of the transaction, so
 * invites to a given organization queue instead of racing. It is keyed on the
 * org, so unrelated organizations never block each other, and it costs nothing
 * when the limit is unlimited because we take it only if a limit applies.
 *
 * Inert today — the only plan with team features is Enterprise at -1. That is
 * exactly why the locking has to be right now rather than later: the comment at
 * the call site promises a seat-priced tier needs only a config change.
 */
export async function assertSeatAvailable(orgId: string, tx: SeatDb): Promise<void> {
  const dbCtx = tx;
  const limit = await getOrgOwnerPlanLimit(orgId, dbCtx);

  // -1 = unlimited
  if (limit === -1) return;

  // Serialise concurrent invites for THIS organization. Released on commit or
  // rollback, so a failed invite never leaves the lock held.
  await dbCtx.execute(sql`select pg_advisory_xact_lock(hashtext(${orgId}))`);

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
 * Assert the organization's owner still has an active Enterprise subscription.
 * Call this in every org-scoped data route after confirming membership.
 *
 * Throws PLAN_NOT_ALLOWED if the subscription is absent, cancelled, unpaid,
 * or on a plan that doesn't include teamFeatures.
 */
export async function assertOrgPlanActive(orgId: string): Promise<void> {
  const ownerMember = await db.query.member.findFirst({
    where: and(eq(member.organizationId, orgId), eq(member.role, "owner")),
  });

  if (!ownerMember) {
    throw new TeamPermissionError("FORBIDDEN", "Organization has no owner");
  }

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, ownerMember.userId),
  });

  const expired =
    !sub ||
    sub.status === "canceled" ||
    sub.status === "unpaid" ||
    sub.status === "incomplete";

  if (expired) {
    throw new TeamPermissionError(
      "PLAN_NOT_ALLOWED",
      "Your organization's Enterprise plan has expired. Renew to access team data."
    );
  }

  const plan: PlanId = sub.stripePriceId ? priceToPlan(sub.stripePriceId) : "free";
  if (!PLAN_LIMITS[plan].teamFeatures) {
    throw new TeamPermissionError(
      "PLAN_NOT_ALLOWED",
      "Team features require the Enterprise plan."
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

  /**
   * One organization per account, for now.
   *
   * Counts organizations this user OWNS, not ones they belong to: being invited
   * into a colleague's org must not consume your own allowance. Ownership is
   * also where billing sits (`getOrgOwnerPlanLimit`), so "how many may I own"
   * and "how many am I paying for" stay the same question.
   */
  const owned = await db
    .select({ value: count() })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, "owner")));

  if ((owned[0]?.value ?? 0) >= 1) {
    throw new TeamPermissionError(
      "PLAN_NOT_ALLOWED",
      "Your plan includes one organization. Switch to it, or contact us to add another."
    );
  }
}

/**
 * Whether this user's own subscription could support owning an organization.
 *
 * The org's entitlement is read from whoever holds the `owner` role
 * (`assertOrgPlanActive` → `getOrgOwnerPlanLimit`), so ownership and billing are
 * the same fact. Handing the role to someone without the plan therefore does not
 * just change a label — it revokes team features for every member at once.
 */
export async function userPlanHasTeamFeatures(userId: string): Promise<boolean> {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  let plan: PlanId = "free";
  if (sub && sub.status !== "canceled" && sub.status !== "unpaid" && sub.status !== "incomplete") {
    plan = sub.stripePriceId ? priceToPlan(sub.stripePriceId) : "free";
  }
  return PLAN_LIMITS[plan].teamFeatures;
}

// ─── Resource-Level Authorization ───────────────────────────────────────────

/**
 * Check if a user can mutate a team-scoped resource.
 *
 * Rules:
 * - Personal resource (organizationId=null): only creator can mutate
 * - Team resource: owner/admin can always mutate; member only if they created it
 *
 * `resource.userId` may be NULL on content tables whose author has deleted
 * their account — see the `user_id` docblock in `db/app-schema.ts`. An
 * authorless *team* row stays mutable by owners and admins, which is what makes
 * it possible to clean up; a plain member simply is not its creator. An
 * authorless *personal* row belongs to nobody and is refused outright: account
 * deletion removes personal rows, so reaching that branch means something is
 * wrong, and failing closed is the safe way to be wrong.
 */
export async function assertCanMutateResource(
  userId: string,
  resource: { userId: string | null; organizationId: string | null }
): Promise<void> {
  if (!resource.organizationId) {
    // Personal resource — only creator
    if (resource.userId === null || resource.userId !== userId) {
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
