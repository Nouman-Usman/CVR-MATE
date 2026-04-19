# Enterprise Team Management — Implementation Plan (COMPLETE)

## Why This Exists

Better Auth's organization plugin is wired but incomplete for enterprise use. Four gaps must be closed:

| Gap | Risk |
|-----|------|
| No plan enforcement | Free users can create teams today — billing hole |
| No server-side RBAC | Any member can call invite/remove endpoints directly |
| Invites auto-accept | Invitee has no "preview before joining" — unprofessional |
| No shared workspace | Team is cosmetic; data doesn't cross member boundaries |

**Chosen data model:** Shared workspace. Nullable `organizationId` FK added to `leadTrigger`, `savedCompany`, `todo`. Personal rows keep `null`; team rows carry the org ID.

---

## Security Principles (govern every phase)

These five rules apply everywhere and are not negotiable:

1. **Never trust session blindly** — always call `assertUserIsMemberOfOrg(userId, activeOrgId)` before using activeOrganizationId from session
2. **Resource-level auth, not just org-level** — being in the org does not mean you can touch every record in it
3. **Seat counts must be transactional** — read + check + write must be atomic
4. **Explicit over implicit** — APIs accept explicit `orgId`; do not hard-couple everything to "active org"
5. **Every action is audited** — every route that mutates team state must write an `orgAuditLog` row

---

## Permission Matrix

```
action                    | owner | admin | member
--------------------------|-------|-------|-------
create org                |  own  |  —    |  —
invite member             |  ✓    |  ✓    |  —
invite admin              |  ✓    |  ✓    |  —
cancel invitation         |  ✓    |  ✓    |  —
decline invitation        |  invitee only (any auth state)
remove member             |  ✓    |  ✓*   |  —      * only if target rank < actor rank
remove admin              |  ✓    |  —    |  —
change role (any)         |  ✓    |  —    |  —
transfer ownership        |  ✓    |  —    |  —
rename org                |  ✓    |  ✓    |  —
delete org                |  ✓    |  —    |  —
leave org                 |  —    |  ✓    |  ✓
view team members         |  ✓    |  ✓    |  ✓
view shared resources     |  ✓    |  ✓    |  ✓
edit/delete own records   |  ✓    |  ✓    |  ✓
edit/delete others' records|  ✓   |  ✓    |  —
```

Role rank: owner=3, admin=2, member=1. An actor cannot act on anyone with equal or higher rank.

---

## Phase 1 — Security Foundation

> Ship before any UI. Closes billing hole, RBAC gap, and multi-tenant trust issues.

### 1.1 Schema: `orgAuditLog` table (`db/app-schema.ts`)

```typescript
export const orgAuditLog = pgTable("org_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id")
    .references(() => organization.id, { onDelete: "cascade" }).notNull(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  // Actions:
  //   org_created | org_renamed | org_deleted
  //   member_invited | invitation_accepted | invitation_declined | invite_revoked
  //   member_removed | member_left
  //   role_changed | ownership_transferred
  //   seat_limit_reached | permission_denied
  targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").default({}),  // stores: role, email, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("audit_org_idx").on(t.organizationId),
  index("audit_created_idx").on(t.createdAt),
]);
```

Add `softDeletedAt` to invitation table (allows decline without hard delete):
```typescript
// In existing invitation table definition in db/auth-schema.ts:
softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
// Note: Better Auth owns this table — if it cannot be extended, soft-delete
// is tracked separately in orgAuditLog with action: "invitation_declined"
```

Run: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`

### 1.2 `lib/stripe/plans.ts`

Add to `PlanLimits` interface:
```typescript
teamMemberLimit: number;  // 0 = no teams, -1 = unlimited
```

Plan values:
```typescript
free:         { teamMemberLimit: 0, ... }
starter:      { teamMemberLimit: 0, ... }
professional: { teamMemberLimit: 0, ... }
enterprise:   { teamMemberLimit: -1, ... }
```

### 1.3 `lib/team/permissions.ts` (new file)

```typescript
const RANK = { owner: 3, admin: 2, member: 1 } as const;

// Always verifies against DB — never trusts passed-in role strings alone
export async function getOrgMembership(userId: string, orgId: string)
export async function assertUserIsMemberOfOrg(userId: string, orgId: string)

// Throws: "NOT_MEMBER" | "INSUFFICIENT_PERMISSIONS" | "CANNOT_ACT_ON_HIGHER_ROLE"
export async function assertPermission(userId: string, orgId: string, action: TeamAction)
export async function assertCanActOnMember(actorRole: string, targetRole: string)

// Atomic seat check — runs inside a transaction
// Counts active members + pending (non-declined, non-expired) invites
export async function assertSeatAvailable(orgId: string, db: Tx): Promise<void>
// NOTE: caller must wrap in db.transaction() — assertSeatAvailable takes the tx handle
```

**Seat check implementation (race-condition safe):**
```typescript
// Inside the invite handler:
await db.transaction(async (tx) => {
  await assertSeatAvailable(orgId, tx);  // reads + checks inside same tx
  await tx.insert(invitation).values(...);
});
// Any concurrent invite will block on the same tx lock
```

### 1.4 Custom API routes

All routes follow this guard pattern at the top:
```typescript
const session = await auth.api.getSession({ headers: req.headers });
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const { orgId } = await req.json();
await assertUserIsMemberOfOrg(session.user.id, orgId);  // always DB-verified
```

| Route | Method | Permission check | Seat check | Audit log |
|-------|--------|-----------------|------------|-----------|
| `/api/team/create` | POST | Enterprise plan only | n/a | `org_created` |
| `/api/team/invite` | POST | owner/admin | ✓ (transactional) | `member_invited` |
| `/api/team/members/[memberId]` | DELETE | owner/admin + rank hierarchy | — | `member_removed` |
| `/api/team/members/[memberId]/role` | PATCH | owner only | — | `role_changed` |
| `/api/team/invitations/[invId]` | DELETE | owner/admin | — | `invite_revoked` |
| `/api/team/invitations/[invId]/decline` | POST | invitee (no membership check) | — | `invitation_declined` |
| `/api/team/leave` | POST | not owner | — | `member_left` |
| `/api/team/transfer-ownership` | POST | owner + target must be existing member | — | `ownership_transferred` |
| `/api/team/[orgId]` | DELETE | owner + org has no team-scoped data* | — | `org_deleted` |
| `/api/team/[orgId]` | PATCH | owner/admin | — | `org_renamed` |

**\* Org deletion safety**: Before deleting, check if any `leadTrigger`, `savedCompany`, or `todo` has this `organizationId`. If so, return 409 with: "Transfer or delete shared team resources before deleting the organization." This prevents silent data orphaning.

**Resource-level authorization** (enforced on all PATCH/DELETE for shared resources):
```typescript
// In triggers/[id], saved-companies/[id], todos/[id]:
const resource = await db.query.leadTrigger.findFirst({ where: eq(leadTrigger.id, id) });
if (!resource) return 404;

if (resource.organizationId) {
  // Team resource — owner/admin can always act; member only if they created it
  const membership = await getOrgMembership(userId, resource.organizationId);
  const isAdminOrOwner = ["owner", "admin"].includes(membership?.role ?? "");
  const isCreator = resource.userId === userId;
  if (!isAdminOrOwner && !isCreator) return 403;
} else {
  // Personal resource — only the creator can act
  if (resource.userId !== userId) return 403;
}
```

**Transfer ownership guards:**
```typescript
// Prevent: self-transfer, target not in org
if (newOwnerId === session.user.id) return 400 "Cannot transfer to self";
const targetMembership = await getOrgMembership(newOwnerId, orgId);
if (!targetMembership) return 400 "Target is not an org member";
// Then: set target.role = "owner", set actor.role = "admin" in one transaction
```

**Plan downgrade protection** (`app/api/subscription/route.ts` or Stripe webhook):
```typescript
// Before or after downgrade:
if (newPlan.teamMemberLimit === 0) {
  const orgCount = await db.query.organization...  // check if user has orgs
  if (orgCount > 0) {
    // Option: block downgrade with message
    return 409 "Dissolve your team before downgrading.";
    // OR: freeze org (future — mark isActive = false)
  }
}
```

---

## Phase 2 — Invite Acceptance UX

> Replaces auto-accept with a branded review screen. Adds decline capability.

### 2.1 `lib/auth.ts` — change inviteUrl

```typescript
// Before:
inviteUrl: `${resolvedBaseURL}/api/auth/organization/accept-invitation/${invitation.id}`
// After:
inviteUrl: `${resolvedBaseURL}/invite/${invitation.id}`
```

### 2.2 `app/invite/[invitationId]/page.tsx` (new — server component)

**Rate limiting**: Add IP-based rate limit (5 req/min) on this route via middleware to prevent enumeration. Better Auth uses UUID v4 for invitation IDs (cryptographically random) — verify this is still the case.

States to handle:

| State | Condition | UI |
|-------|-----------|-----|
| Unauthenticated | No session | Redirect `/login?callbackUrl=/invite/[id]` |
| No account | New email | "Create account to join [OrgName]" → `/signup?callbackUrl=/invite/[id]` |
| Already member | In org members | Redirect to `/` with "Already a member" toast |
| Expired | `expiresAt < now` | "This invitation expired. Contact [InviterName]." |
| Declined | Soft-deleted | "This invitation was declined." |
| Invalid ID | Not found | Generic "Invalid invitation" (no org name leaked) |
| Valid + pending | All good | Preview card |

**Preview card content:**
- Org name + "[InviterName] invited you to join as [Role]"
- Expiry: "Expires in X days"
- **Accept** → `authClient.organization.acceptInvitation({ invitationId })` → write `invitation_accepted` audit row → redirect to `/`
- **Decline** → `POST /api/team/invitations/[id]/decline` → show "Invitation declined" → write `invitation_declined` audit row. Invitation is marked declined (not just expired), freeing the seat immediately.

### 2.3 `app/api/team/invitations/[invId]/decline` route

```typescript
// No membership check — invitee is not yet a member
// Auth check: session.user.email must match invitation.email
// Action: mark invitation declined (soft-delete or status update)
//         write invitation_declined to orgAuditLog
//         return 200
```

---

## Phase 3 — Shared Workspace

> Adds org-scoped data visibility. The most complex phase.

### 3.1 Schema: `organizationId` FK on three tables (`db/app-schema.ts`)

```typescript
// Applied to: leadTrigger, savedCompany, todo

organizationId: text("organization_id")
  .references(() => organization.id, { onDelete: "set null" }),
```

Add composite indexes (performance — OR queries degrade at scale without these):
```typescript
// leadTrigger
index("trigger_user_created_idx").on(t.userId, t.createdAt),
index("trigger_org_created_idx").on(t.organizationId, t.createdAt),

// savedCompany
index("saved_company_user_created_idx").on(t.userId, t.createdAt),
index("saved_company_org_created_idx").on(t.organizationId, t.createdAt),

// todo
index("todo_user_created_idx").on(t.userId, t.createdAt),
index("todo_org_created_idx").on(t.organizationId, t.createdAt),
```

Run: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`

### 3.2 `lib/team/permissions.ts` — `validateActiveOrg`

```typescript
// Called at start of any API route that uses activeOrganizationId from session
export async function validateActiveOrg(
  userId: string,
  activeOrgId: string | null | undefined
): Promise<string | null> {
  if (!activeOrgId) return null;
  // Always DB-verify — never trust session.activeOrganizationId alone
  const membership = await getOrgMembership(userId, activeOrgId);
  if (!membership) return null;  // session stale — silently fall back to personal scope
  return activeOrgId;
}
```

### 3.3 Shared query pattern (applied to all three resource types)

```typescript
const session = await auth.api.getSession({ headers: req.headers });
const activeOrgId = await validateActiveOrg(
  session.user.id,
  session?.session?.activeOrganizationId
);

// List: personal OR team
.where(
  or(
    and(eq(table.userId, session.user.id), isNull(table.organizationId)),
    activeOrgId ? eq(table.organizationId, activeOrgId) : sql`false`
  )
)

// Create: client sends { scope: "personal" | "team" }
// "team" only valid if user has an activeOrg AND is a member
const orgId = body.scope === "team" && activeOrgId ? activeOrgId : null;
```

**Routes to update:**
- `app/api/triggers/route.ts` — GET list + POST create
- `app/api/triggers/[id]/route.ts` — GET, PATCH, DELETE (resource-level auth from Phase 1)
- `app/api/saved-companies/route.ts` — GET list + POST create
- `app/api/todos/route.ts` — GET list + POST create

### 3.4 Member-leave side effects (`app/api/team/leave/route.ts`)

When a user leaves an org, their team-scoped triggers need handling:

```typescript
// After removing membership, find orphaned triggers:
const orphanedTriggers = await db.query.leadTrigger.findMany({
  where: and(
    eq(leadTrigger.userId, leavingUserId),
    eq(leadTrigger.organizationId, orgId)
  )
});

// Strategy: set isActive = false and organizationId = null
// (preserves data, removes from team scope, stops cron execution)
await db.update(leadTrigger)
  .set({ isActive: false, organizationId: null })
  .where(and(
    eq(leadTrigger.userId, leavingUserId),
    eq(leadTrigger.organizationId, orgId)
  ));
```

Note: saved companies and todos are not disabled — data stays with the user personally.

### 3.5 Cron update (`app/api/cron/triggers/route.ts`)

Include org-scoped triggers (where the user is still a member):
```typescript
// Current: WHERE isActive = true AND userId = ...
// Updated: WHERE isActive = true AND (userId IN activeUserIds OR organizationId IN activeOrgIds)
// Notifications fire to trigger.userId (creator) only — not all org members
// If trigger.userId has left the org: trigger is already disabled (see 3.4 above)
```

### 3.6 Active org context wiring

In settings page `loadOrg()`, after loading:
```typescript
if (orgs.length > 0 && !session.session?.activeOrganizationId) {
  await authClient.organization.setActive({ organizationId: orgs[0].id });
}
```

---

## Phase 4 — Settings UI (`app/settings/page.tsx`)

> Replace raw Better Auth calls with custom `/api/team/*` routes and add management controls.

Replace all `fetch("/api/auth/organization/...")` calls with `/api/team/...` routes.

### New UI components

**Seat usage meter**
```
Team members
[████████░░░░░░░░] 3 active · 1 pending  (Enterprise — Unlimited)
```

**Role dropdown** (owner only — per member row)
- Shows `<select>` with member ↔ admin options
- Owner row shows "Owner" badge, not a dropdown
- On change → `PATCH /api/team/members/[memberId]/role`

**Transfer ownership** (owner only)
- Confirmation modal: "Transfer to [Name]? You will become an admin."
- Guard text: "This cannot be undone without the new owner's cooperation."
- On confirm → `POST /api/team/transfer-ownership`

**Leave org** (admin + member — not owner)
- In Danger Zone section
- Warning: "You will lose access to all shared team resources. Your personal triggers will be deactivated."
- On confirm → `POST /api/team/leave`

**Delete org** (owner only)
- In Danger Zone section
- Requires typing org name (prevents mis-click)
- If shared resources exist → 409 error → show: "Move or delete all shared resources first."
- On confirm → `DELETE /api/team/[orgId]`

**Rename org** (owner/admin)
- Inline editable org name
- On blur with changed value → `PATCH /api/team/[orgId]`

**Plan gate** (non-enterprise users)
- If `subscription.data?.plan !== "enterprise"`, replace team controls with upgrade CTA
- "Team collaboration requires the Enterprise plan."
- Server-side enforcement in Phase 1 backs this up

---

## Phase 5 — Hardening & Edge Cases

> Applied during or after Phase 4. Not blocking for launch, but required before real enterprise customers onboard.

### 5.1 Rate limiting on invite page

Add to `middleware.ts` (or Next.js route middleware):
```typescript
// Rate limit /invite/* — 5 requests per IP per minute
// Prevents enumeration of invitation IDs
```

### 5.2 Downgrade flow hook

In Stripe webhook handler (`app/api/stripe/webhook/route.ts`), on `customer.subscription.updated`:
```typescript
if (newPlanLimits.teamMemberLimit === 0 && oldPlanLimits.teamMemberLimit !== 0) {
  // Check if user has active orgs
  // Option A: block downgrade (return 200 but email user to dissolve team first)
  // Option B: freeze org (add isActive flag to organization table)
  // Recommended: Option A — simpler, safer
}
```

### 5.3 Invite domain restriction (future, configurable per org)

Add to org metadata:
```typescript
allowedEmailDomains: string[];  // e.g. ["acme.com"]
// Enforce in /api/team/invite — if set, reject emails outside domain
```

### 5.4 Audit log viewer (owner/admin in settings)

Simple log list in Team section, paginated, filtered by action type. Useful for compliance and debugging who invited/removed whom.

---

## Implementation Order

```
Step 1.  db/app-schema.ts        → orgAuditLog table
Step 2.  lib/stripe/plans.ts     → add teamMemberLimit to PlanLimits
Step 3.  Run: pnpm drizzle-kit generate && pnpm drizzle-kit migrate
Step 4.  lib/team/permissions.ts → RBAC + validateActiveOrg + assertSeatAvailable
Step 5.  /api/team/* routes      → All 10 Phase 1 routes (with audit logging)
Step 6.  lib/auth.ts             → change inviteUrl
Step 7.  app/invite/[id]/page    → invite acceptance + rate limit in middleware
Step 8.  /api/team/invitations/[id]/decline → decline route
Step 9.  db/app-schema.ts        → organizationId FKs + composite indexes on 3 tables
Step 10. Run: pnpm drizzle-kit generate && pnpm drizzle-kit migrate
Step 11. Update list/create APIs → org-scoped queries + resource-level auth
Step 12. app/api/cron/triggers   → include org triggers, handle orphaned
Step 13. app/settings/page.tsx   → Phase 4 UI (role dropdown, leave/delete, etc.)
Step 14. Stripe webhook          → downgrade protection hook
Step 15. middleware.ts           → invite rate limiting
```

---

## File Index

### New files
- `lib/team/permissions.ts`
- `app/invite/[invitationId]/page.tsx`
- `app/api/team/create/route.ts`
- `app/api/team/invite/route.ts`
- `app/api/team/members/[memberId]/route.ts`
- `app/api/team/members/[memberId]/role/route.ts`
- `app/api/team/invitations/[invId]/route.ts` (cancel — owner/admin)
- `app/api/team/invitations/[invId]/decline/route.ts` (decline — invitee)
- `app/api/team/leave/route.ts`
- `app/api/team/transfer-ownership/route.ts`
- `app/api/team/[orgId]/route.ts`

### Modified files
- `lib/stripe/plans.ts` — `teamMemberLimit`
- `lib/auth.ts` — inviteUrl
- `db/app-schema.ts` — orgAuditLog + organizationId FKs + indexes
- `app/settings/page.tsx` — full Phase 4 UI
- `app/api/triggers/route.ts`
- `app/api/triggers/[id]/route.ts`
- `app/api/saved-companies/route.ts`
- `app/api/todos/route.ts`
- `app/api/cron/triggers/route.ts`
- `app/api/stripe/webhook/route.ts` — downgrade hook
- `middleware.ts` — rate limiting for /invite/*

---

## Verification Checklist

### Phase 1 — Security
- [ ] Free user → Settings → Team → upgrade CTA, API returns 403 if called directly
- [ ] Enterprise user creates org → `orgAuditLog` row: `org_created`
- [ ] Concurrent invite requests (2 admins at same time, limit=5, 4 existing members) → exactly 1 succeeds, other gets 409
- [ ] Member calls `POST /api/team/invite` directly → 403
- [ ] Admin tries to remove another admin → 403
- [ ] Admin tries to remove owner → 403
- [ ] Transfer to non-member → 400
- [ ] Transfer to self → 400
- [ ] Org delete with shared triggers → 409 "Move shared resources first"
- [ ] Downgrade with active org → 409 "Dissolve team first"

### Phase 2 — Invite UX
- [ ] Email link → `/invite/[id]` preview page (not auto-accept)
- [ ] Unauthenticated invitee → redirected to login, then back to invite
- [ ] Invalid UUID → generic "Invalid invitation" (no org name leaked)
- [ ] Expired invite → expiry message
- [ ] Accept → `invitation_accepted` audit row → member appears in list
- [ ] Decline → `invitation_declined` audit row → seat freed immediately → can re-invite same email

### Phase 3 — Shared workspace
- [ ] User creates trigger with `scope: "team"` → visible to org member
- [ ] User creates trigger with `scope: "personal"` → NOT visible to org member
- [ ] Member can edit/delete their own team trigger
- [ ] Member cannot edit another member's team trigger → 403
- [ ] Admin can edit any team trigger
- [ ] User leaves org → their team triggers set to `isActive=false, organizationId=null`
- [ ] Cron includes org trigger, notification goes to `trigger.userId` only
- [ ] activeOrganizationId with revoked membership → silently falls back to personal scope (no data leak)

### Phase 4 — Settings UI
- [ ] Role dropdown changes member to admin → badge updates
- [ ] Transfer ownership → role badges swap
- [ ] Leave org warning mentions trigger deactivation
- [ ] Delete org blocked if shared resources exist
- [ ] Org rename updates header
- [ ] Seat meter shows correct count (active + pending)
- [ ] Audit log shows all actions above

### Phase 5 — Hardening
- [ ] 6+ requests to `/invite/*` in 1 minute from same IP → rate limited
- [ ] Audit log events present for: `seat_limit_reached`, `permission_denied`, `member_left`, `invite_revoked`, `invitation_declined`
