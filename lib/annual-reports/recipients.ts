/**
 * Who should be told that a followed company filed an annual report.
 *
 * PURE. No database — the caller supplies the follows and the org roster, so
 * the rule can be tested without one.
 *
 * Two questions that are deliberately NOT the same question:
 *
 *   "Can this person MANAGE the follow?"   → the role hierarchy
 *   "Who should KNOW this happened?"       → this module
 *
 * A plain member who followed a company is a recipient even though they may
 * not be allowed to remove a colleague's follow. Role governs authority, never
 * audience — dropping the follower would silently unsubscribe the one person
 * who explicitly asked.
 */

export type OrgRoleName = "owner" | "admin" | "member";

export interface FollowRecord {
  id: string;
  userId: string;
  organizationId: string | null;
}

export interface OrgMember {
  userId: string;
  role: OrgRoleName;
}

/** Roles that receive organizational visibility regardless of who followed. */
const VISIBILITY_ROLES: ReadonlySet<OrgRoleName> = new Set<OrgRoleName>(["owner", "admin"]);

/**
 * Recipients for one follow.
 *
 *   personal → the follower
 *   org      → owners ∪ admins ∪ follower, deduplicated
 *
 * Returns a stable, sorted list so callers and tests are order-independent.
 */
export function recipientsForFollow(
  follow: FollowRecord,
  orgMembers: OrgMember[] = []
): string[] {
  // The follower is added FIRST and unconditionally: no role check may remove
  // them. An owner who also followed appears once, via the Set.
  const recipients = new Set<string>([follow.userId]);

  if (follow.organizationId) {
    for (const m of orgMembers) {
      if (VISIBILITY_ROLES.has(m.role)) recipients.add(m.userId);
    }
  }

  return [...recipients].sort();
}

export interface NotifiableItem<T> {
  follow: FollowRecord;
  payload: T;
}

/**
 * Group notifiable items by recipient, so one person receives one digest
 * containing everything — not one message per follow that happens to match.
 *
 * A recipient reachable through several follows (their own, plus admin
 * visibility on two colleagues') appears once, with the union of the payloads.
 * Payload identity is the caller's business: `keyOf` decides what counts as
 * the same item, so the same company period arriving via two follows collapses
 * to a single entry.
 */
export function groupByRecipient<T>(
  items: NotifiableItem<T>[],
  membersByOrg: Map<string, OrgMember[]>,
  keyOf: (payload: T) => string
): Map<string, T[]> {
  const byRecipient = new Map<string, Map<string, T>>();

  for (const item of items) {
    const members = item.follow.organizationId
      ? (membersByOrg.get(item.follow.organizationId) ?? [])
      : [];

    for (const userId of recipientsForFollow(item.follow, members)) {
      const bucket = byRecipient.get(userId) ?? new Map<string, T>();
      // Keyed, so the same report reaching someone through two follows is one
      // line in their digest rather than two.
      bucket.set(keyOf(item.payload), item.payload);
      byRecipient.set(userId, bucket);
    }
  }

  const result = new Map<string, T[]>();
  for (const [userId, bucket] of byRecipient) {
    result.set(userId, [...bucket.values()]);
  }
  return result;
}
