import { z } from "zod";

/**
 * Request schemas for the team/organization routes.
 *
 * These routes predate `lib/validation/crm.ts` and parsed raw JSON with
 * `body as { email?: string }` — so `/api/team/invite` accepted any non-empty
 * string as an email address, created an invitation row for it, and tried to
 * send mail to it. Every other module in the app validates; this brings these
 * up to the same standard.
 */

/**
 * An invite can only grant admin or member. Ownership moves through
 * `/api/team/transfer-ownership`, which is a different operation with a
 * different rule — there is exactly one owner, and handing that over must
 * demote the previous one in the same transaction.
 */
export const invitableRole = z.enum(["admin", "member"]);
export type InvitableRole = z.infer<typeof invitableRole>;

/**
 * Stored lowercased so the "already invited" and "already a member" lookups
 * match regardless of how the address was typed. Length caps the local+domain
 * at the RFC-practical maximum.
 */
const teamEmail = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(320)
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

/** Better Auth ids are opaque strings, not uuids — do not tighten this. */
const entityId = z.string().trim().min(1).max(128);

export const inviteMemberSchema = z.object({
  email: teamEmail,
  role: invitableRole.default("member"),
  organizationId: entityId,
});

export const changeRoleSchema = z.object({
  // "owner" is deliberately absent: promoting to owner via this route would
  // leave two owners, which the rank checks in lib/team/permissions.ts assume
  // cannot happen.
  role: invitableRole,
});

export const transferOwnershipSchema = z.object({
  organizationId: entityId,
  newOwnerId: entityId,
});

export const leaveOrgSchema = z.object({
  organizationId: entityId,
});

export const renameOrgSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required").max(200),
});
