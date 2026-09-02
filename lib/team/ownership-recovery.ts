/**
 * Recovering an organization that has lost its owner.
 *
 * `member_single_owner_uq` enforces AT MOST one owner. Nothing enforces AT
 * LEAST one — that half of the invariant cannot be expressed as a partial
 * unique index — so an org can end up with members and no owner. It happens
 * when the owner's user row is deleted out of band: `member.user_id` cascades,
 * their membership disappears, and the organization is left standing.
 *
 * That state is unrecoverable by any user:
 *
 *   • `assertOrgPlanActive` throws "Organization has no owner" → CRM off for
 *     every member
 *   • transfer-ownership is owner-only, so no member can rescue it
 *   • the memberless-org sweep does not apply — the org still has members
 *
 * The selection below is PURE so the promotion rule can be tested without a
 * database. Applying it lives in the cron.
 */

export type MemberRole = "owner" | "admin" | "member";

export interface SuccessorCandidate {
  userId: string;
  role: MemberRole;
  /** Membership creation time, ISO or Date — earliest wins a tie. */
  createdAt: Date;
  /**
   * Whether this user's own subscription carries team features.
   *
   * The org's entitlement is read from whoever holds `owner`, so promoting
   * someone without a plan keeps the org running but leaves CRM gated. Still
   * strictly better than ownerless, which gates it AND cannot be fixed.
   */
  hasTeamFeatures: boolean;
}

/**
 * Who should inherit an ownerless organization.
 *
 * Ordered by how closely the candidate already resembles an owner:
 *
 *   1. admin with team features   — already trusted, and can pay for it
 *   2. admin                      — already trusted
 *   3. member with team features  — can at least keep the org functional
 *   4. member                     — better than no owner at all
 *
 * Ties break on the oldest membership, then on `userId`, so the outcome is
 * deterministic and a re-run promotes the same person rather than shuffling
 * ownership around.
 */
export function pickSuccessor(candidates: SuccessorCandidate[]): SuccessorCandidate | null {
  const eligible = candidates.filter((c) => c.role !== "owner");
  if (eligible.length === 0) return null;

  const rank = (c: SuccessorCandidate): number => {
    if (c.role === "admin") return c.hasTeamFeatures ? 0 : 1;
    return c.hasTeamFeatures ? 2 : 3;
  };

  return [...eligible].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    const byAge = a.createdAt.getTime() - b.createdAt.getTime();
    if (byAge !== 0) return byAge;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  })[0];
}

/** True when this set of members has nobody holding the owner role. */
export function isOwnerless(candidates: { role: MemberRole }[]): boolean {
  return candidates.length > 0 && !candidates.some((c) => c.role === "owner");
}
