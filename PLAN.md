# Enterprise Team Management — Implementation Plan

## Why This Exists

Better Auth's organization plugin is wired but incomplete for enterprise use. Four gaps must be closed:

| Gap | Risk |
|-----|------|
| No plan enforcement | Free users can create teams today — billing hole |
| No server-side RBAC | Any member can call invite/remove endpoints directly |
| Invites auto-accept | Invitee has no "preview before joining" — looks amateur |
| No shared workspace | Team is cosmetic; data doesn't cross member boundaries |

**Chosen data model:** Shared workspace. `organizationId` (nullable FK) added to `leadTrigger`, `savedCompany`, `todo`. Personal rows keep `organizationId = null`; team rows set it to the org ID.

---

## Architecture Decisions

### Permission Hierarchy
```
owner  → everything (delete org, transfer ownership, change any role, all admin perms)
admin  → invite members/admins, remove members (not admins or owner), cancel invites
member → view team data, leave org — cannot invite or remove
```
An actor can only remove/demote a member whose role rank is strictly lower than their own.

### Invite Flow (replaces auto-accept)
`inviteUrl` in `lib/auth.ts` will point to `/invite/[invitationId]` (custom page) instead of Better Auth's accept endpoint. The page shows org + inviter + role before accepting.

### Seat Limits
`teamMemberLimit` added to `PlanLimits`: `0` for free/starter/professional, `-1` (unlimited) for enterprise.

### Active Org Context
Better Auth's session already has `activeOrganizationId`. All list/create API routes read this field to include team-scoped resources.

---

## Phase 1 — Security Foundation

> Must ship before any UI changes. Closes the billing and RBAC holes.

### Files to create

**`lib/team/permissions.ts`**
- `assertPermission(userId, orgId, action)` — queries `member` table, throws if role insufficient
- `assertCanActOnMember(actorRole, targetRole)` — enforces role hierarchy
- `assertSeatAvailable(inviterId, orgId)` — checks plan `teamMemberLimit` vs current member + invite count

**Custom API routes (replace direct Better Auth calls from settings page)**

| Route | Method | Guards |
|-------|--------|--------|
| `/api/team/create` | POST | Session + Enterprise plan |
| `/api/team/invite` | POST | Session + owner/admin + seat check |
| `/api/team/members/[memberId]` | DELETE | Session + owner/admin + role hierarchy |
| `/api/team/members/[memberId]/role` | PATCH | Session + owner only |
| `/api/team/invitations/[invId]` | DELETE | Session + owner/admin |
| `/api/team/leave` | POST | Session + not owner |
| `/api/team/[orgId]` | DELETE | Session + owner |
| `/api/team/[orgId]` | PATCH | Session + owner/admin |
| `/api/team/transfer-ownership` | POST | Session + owner |

Every route calls `auth.api.getSession({ headers: req.headers })` — never trusts request body for identity.

### Files to modify

**`lib/stripe/plans.ts`**
- Add `teamMemberLimit: number` to `PlanLimits` interface
- Set: `free: 0`, `starter: 0`, `professional: 0`, `enterprise: -1`

**`db/app-schema.ts`** — new `orgAuditLog` table
```typescript
export const orgAuditLog = pgTable("org_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id")
    .references(() => organization.id, { onDelete: "cascade" }).notNull(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  // actions: org_created | member_invited | invitation_accepted | invitation_declined
  //          member_removed | role_changed | ownership_transferred | org_deleted | org_renamed
  targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("audit_org_idx").on(t.organizationId),
  index("audit_created_idx").on(t.createdAt),
]);
```

Run: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`

---

## Phase 2 — Invite Acceptance UX

> Transforms the invite from "silent auto-join" to a branded, enterprise-quality handoff.

### Files to modify

**`lib/auth.ts`**
```typescript
// Change this line:
inviteUrl: `${resolvedBaseURL}/api/auth/organization/accept-invitation/${invitation.id}`
// To:
inviteUrl: `${resolvedBaseURL}/invite/${invitation.id}`
```

### Files to create

**`app/invite/[invitationId]/page.tsx`** — server component

States to handle:

| State | Condition | UI |
|-------|-----------|-----|
| Unauthenticated | No session | Redirect to `/login?callbackUrl=/invite/[id]` |
| New user | No account | "Create account to join [OrgName]" → `/signup?callbackUrl=/invite/[id]` |
| Already member | userId in org members | Redirect to `/` |
| Expired | `expiresAt < now` | "This invitation has expired. Contact the team admin." |
| Invalid ID | Not found in DB | 404 message |
| Valid + pending | All good | Preview card (see below) |

**Preview card content:**
- Org name + slug
- "[InviterName] invited you to join as [Role]"
- Expiry: "Expires in X days"
- **Accept** button → `authClient.organization.acceptInvitation({ invitationId })` → redirect to `/`
- **Decline** button → client-side dismiss toast (invitations expire automatically — no explicit decline endpoint needed)

---

## Phase 3 — Shared Workspace

> Org members see each other's triggers, saved companies, and tasks.

### DB changes (`db/app-schema.ts`)

Add nullable `organizationId` FK + index to three tables:

```typescript
// leadTrigger, savedCompany, todo — same pattern on each:
organizationId: text("organization_id")
  .references(() => organization.id, { onDelete: "set null" }),
```

Add `index("table_org_idx").on(t.organizationId)` for each.

Run: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`

### API routes to update

**Pattern applied to all three resource types:**
```typescript
const session = await auth.api.getSession({ headers: req.headers });
const activeOrgId = session?.session?.activeOrganizationId ?? null;

// List query:
.where(
  or(
    eq(table.userId, session.user.id),
    activeOrgId ? eq(table.organizationId, activeOrgId) : sql`false`
  )
)

// Create: attach organizationId if client sends scope: "team"
// or if session.activeOrganizationId is set and no explicit personal scope
```

**Routes to update:**

| Route | Change |
|-------|--------|
| `app/api/triggers/route.ts` | GET list + POST create — org-scoped |
| `app/api/triggers/[id]/route.ts` | PATCH/DELETE — verify ownership or admin role |
| `app/api/saved-companies/route.ts` | GET list + POST create — org-scoped |
| `app/api/todos/route.ts` | GET list + POST create — org-scoped |
| `app/api/cron/triggers/route.ts` | Include org triggers; notifications fire to `trigger.userId` only |

### Active org context wiring

In settings page `loadOrg()`, after loading the org, call:
```typescript
await authClient.organization.setActive({ organizationId: orgs[0].id });
```
This persists `activeOrganizationId` to the session so all subsequent API calls see the org context.

---

## Phase 4 — Settings UI (`app/settings/page.tsx`)

> Replace raw `fetch("/api/auth/organization/...")` with custom `/api/team/...` routes and add new management controls.

### New UI elements to add

**Seat usage meter** (shows above member list)
```
Team members  3 active · 1 pending
[████████░░░░░░░░░░░░]  Enterprise — Unlimited seats
```

**Role management** (owner only)
- Each member row gets a role `<select>` (member ↔ admin)
- Owner row shows "Owner" badge — no dropdown
- On change → `PATCH /api/team/members/[memberId]/role`

**Transfer ownership** (owner only)
- Button at bottom of member list
- Confirmation modal: "Transfer ownership to [Name]? You will become an admin."
- On confirm → `POST /api/team/transfer-ownership`

**Leave organization** (members + admins — not owner)
- In Danger Zone section, shown only to non-owners in a team
- Warning: "You will lose access to all shared team resources."
- On confirm → `POST /api/team/leave`

**Delete organization** (owner only)
- In Danger Zone section, owner only
- Requires typing org name to confirm (prevents mis-click)
- On confirm → `DELETE /api/team/[orgId]`

**Rename organization** (owner/admin)
- Inline editable org name at top of Team section
- On blur with changed value → `PATCH /api/team/[orgId]`

**Plan gate** (non-enterprise users)
- If `subscription.data?.plan !== "enterprise"`, show upgrade CTA instead of team controls
- "Team features require the Enterprise plan → [Upgrade]"
- Server-side enforcement in Phase 1 backs this up

---

## Implementation Order

```
1. db/app-schema.ts      → orgAuditLog table
2. lib/stripe/plans.ts   → teamMemberLimit
3. migrate               → pnpm drizzle-kit generate && migrate
4. lib/team/permissions  → RBAC helpers (pure logic, no UI deps)
5. /api/team/* routes    → All 9 Phase 1 routes
6. lib/auth.ts           → change inviteUrl
7. app/invite/[id]/page  → invite acceptance page
8. db/app-schema.ts      → organizationId FKs on 3 tables + migrate
9. API list/create routes → org-scoped queries (Phase 3)
10. app/api/cron/triggers → include org triggers
11. app/settings/page.tsx → Phase 4 + Phase 5 UI
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
- `app/api/team/invitations/[invId]/route.ts`
- `app/api/team/leave/route.ts`
- `app/api/team/transfer-ownership/route.ts`
- `app/api/team/[orgId]/route.ts`

### Modified files
- `lib/stripe/plans.ts`
- `lib/auth.ts`
- `db/app-schema.ts`
- `app/settings/page.tsx`
- `app/api/triggers/route.ts`
- `app/api/triggers/[id]/route.ts`
- `app/api/saved-companies/route.ts`
- `app/api/todos/route.ts`
- `app/api/cron/triggers/route.ts`

---

## Verification Checklist

- [ ] Free user → Settings → Team → sees upgrade CTA, cannot create org
- [ ] Enterprise user creates org → `orgAuditLog` row: `org_created`
- [ ] Admin invites user → email link opens `/invite/[id]` preview page
- [ ] Invitee accepts → joins org → `invitation_accepted` audit row
- [ ] Invitee clicks Decline → nothing changes in DB, invitation expires naturally
- [ ] Member calls `POST /api/team/invite` directly → 403
- [ ] Admin cannot remove another admin or owner → 403
- [ ] Owner changes member → admin → role updates in settings UI
- [ ] Owner transfers ownership → roles swap, old owner becomes admin
- [ ] Non-owner member leaves → removed from list, loses team data visibility
- [ ] Enterprise user creates trigger (team scope) → team member sees it in trigger list
- [ ] Personal trigger (`organizationId = null`) not visible to team members
- [ ] Cron runs org trigger → notification fires to `trigger.userId` only (not all members)
- [ ] Owner types org name and deletes org → all members lose team data
- [ ] Every action above produces correct `orgAuditLog` row
