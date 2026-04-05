# CVR-MATE: Pricing Migration Implementation Plan

> Migrating from 3-tier (free/go/flow at 0/2999/4999 DKK) to 4-tier (free/starter/professional/enterprise at 0/299/699/1699 DKK)

---

## Context

The business plan (CVR-MATE-Business-Plan-and-Pricing.html) defines a new 4-tier pricing structure with significantly lower prices (targeting mass market), more granular feature gating (per-type draft quotas, enrichment limits, task caps), and a new Enterprise tier with team features and SLA. The current codebase has 3 tiers with coarser limits. This plan migrates the pricing engine, Stripe integration, entitlement checks, and API enforcement with zero downtime.

---

## Phase 0: Feature Flag (Day 0)

**Create `lib/feature-flags.ts`:**
```ts
export function isNewPricing(): boolean {
  return process.env.FF_NEW_PRICING === "true";
}
```
- Env-based toggle — zero infrastructure cost
- Gates which plan definitions are active during transition
- Removed after full rollout (Day 30)

**Pros:** No additional service needed, instant toggle via Vercel env
**Cons:** Requires redeploy to toggle (60s), not per-user granular
**Verdict:** Acceptable for a one-time migration flag

---

## Phase 1: Type System & Plan Configuration

### File: `lib/stripe/plans.ts`

**1a. Expand PlanId type:**
```ts
export type PlanId = "free" | "starter" | "professional" | "enterprise";
```

**1b. Redesign PlanLimits interface — 19 features:**

| Field | Type | Description |
|-------|------|-------------|
| `savedCompanies` | number | 5 / 25 / 100 / ∞ |
| `triggers` | number | 1 / 3 / 5 / ∞ |
| `followedPeople` | number | 0 / 0 / 10 / ∞ |
| `tasks` | number | **NEW** 5 / 10 / ∞ / ∞ |
| `crmConnections` | number | **CHANGED** (was boolean) 0 / 0 / 1 / 3 |
| `companySearchesPerMonth` | number | 10 / 50 / 500 / ∞ |
| `aiUsagesPerMonth` | number | 5 / 10 / 50 / ∞ |
| `enrichmentsPerMonth` | number | **NEW** 3 / 10 / 30 / ∞ |
| `emailDraftsPerMonth` | number | **NEW** 3 / 5 / 30 / ∞ |
| `linkedinDraftsPerMonth` | number | **NEW** 3 / 5 / 30 / ∞ |
| `phoneDraftsPerMonth` | number | **NEW** 3 / 5 / 30 / ∞ |
| `exportsPerMonth` | number | 10 / 15 / 30 / ∞ |
| `aiTaskSuggestPerMonth` | number | **NEW** 3 / 20 / ∞ / ∞ |
| `bulkPushPerMonth` | number | **NEW** 0 / 0 / 30 / ∞ |
| `teamFeatures` | boolean | false / false / false / true |
| `brandPersonalization` | boolean | **NEW** false / true / true / true |
| `calendarExport` | boolean | **NEW** true (all tiers) |
| `contextMenus` | boolean | **NEW** true (all tiers) |
| `prioritySupport` | boolean | false / false / false / true |

**1c. Legacy plan mapping:**
```ts
// go (2999 DKK) → professional (699 DKK) — users get price reduction + same features
// flow (4999 DKK) → enterprise (1699 DKK) — users get price reduction + same features
```
Rationale: Go users had 100 saved companies, 5 triggers, CRM access — matches Professional. Downgrading to Starter would break their workflows.

**1d. Update `priceToPlan()` — supports 8 price IDs:**
- 6 new (3 monthly + 3 annual for starter/professional/enterprise)
- 2 legacy (go → professional, flow → enterprise)

**1e. Annual pricing:**
- 20% discount baked into Stripe Price amount (not computed at runtime)
- Same `PlanId` for both intervals — entitlements are plan-based, not price-based
- Annual prices: 2,871 / 6,710 / 16,310 DKK

**Env vars needed (8 new, 2 legacy kept):**
```
NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID
NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID
NEXT_PUBLIC_STRIPE_GO_PRICE_ID      (legacy, kept for webhook compat)
NEXT_PUBLIC_STRIPE_FLOW_PRICE_ID    (legacy, kept for webhook compat)
```

---

## Phase 2: Entitlements Engine Expansion

### File: `lib/stripe/entitlements.ts`

**2a. Expand MonthlyFeature type (3 → 9):**
```ts
export type MonthlyFeature =
  | "ai_usage" | "company_search" | "export"    // existing
  | "enrichment" | "email_draft" | "linkedin_draft" | "phone_draft"  // new
  | "ai_task_suggest" | "bulk_push";            // new
```
No DB migration needed — `usage_record.feature` is `text`, not an enum.

**2b. Update FEATURE_TO_LIMIT mapping** — connect 9 features to PlanLimits keys.

**2c. Add new entitlement functions:**
- `checkCrmEntitlement(userId, currentConnectionCount)` — counts `crm_connection` rows, compares to `crmConnections` limit (0/0/1/3)
- `checkTaskEntitlement(userId, currentTaskCount)` — counts non-completed todos, compares to `tasks` limit (5/10/∞/∞)

**2d. Add batch quota check (solves N+1 problem):**
```ts
export async function checkMultipleQuotas(
  userId: string,
  features: MonthlyFeature[]
): Promise<Record<MonthlyFeature, { allowed: boolean; limit: number; used: number }>>
```
Implementation: 1 DB query for plan + 1 `GROUP BY feature` query on usage_record. Turns 9 potential queries into 2.

**2e. Expand `getUsageSummary()`** — returns all 9 monthly features for the subscription page.

**2f. Legacy plan resolution** — when `sub.plan` is `"go"` or `"flow"`, resolve via `LEGACY_PLAN_MAPPING` before returning from `getUserPlan()`.

---

## Phase 3: Database Migration

### File: `db/app-schema.ts` + migration SQL

**Migration 0015_pricing_migration.sql:**
```sql
-- Auto-migrate legacy plan names (idempotent, safe to re-run)
UPDATE subscription SET plan = 'professional' WHERE plan = 'go';
UPDATE subscription SET plan = 'enterprise' WHERE plan = 'flow';
```

**No new tables or columns needed:**
- `usage_record.feature` is text — new feature strings work immediately
- `crm_connection` table already tracks connections per user
- `todo` table already tracks tasks per user
- No schema changes to `subscription` table (plan column is text)

**Rollback SQL:**
```sql
UPDATE subscription SET plan = 'go' WHERE plan = 'professional';
UPDATE subscription SET plan = 'flow' WHERE plan = 'enterprise';
```

---

## Phase 4: Stripe Integration Updates

### Manual (before deploy): Stripe Dashboard
- Create 3 Products: "CVR-MATE Starter", "CVR-MATE Professional", "CVR-MATE Enterprise"
- Create 6 Prices: 3 monthly (299, 699, 1699 DKK) + 3 annual (2871, 6710, 16310 DKK)
- Do NOT archive old Go/Flow products (active subscribers)

### File: `app/api/stripe/checkout/route.ts`
- Update `validPriceIds` array: add 6 new + keep 2 legacy

### File: `app/api/stripe/change-plan/route.ts`
- Update `PLAN_HIERARCHY`: `{ free: 0, starter: 1, professional: 2, enterprise: 3 }`
- Update `getPriceIdForPlan()`: supports 4 tiers + monthly/annual interval
- Update validation: `["free", "starter", "professional", "enterprise"]`

### File: `app/api/stripe/webhook/route.ts`
- No structural changes — `priceToPlan()` handles the mapping

---

## Phase 5: API Route Entitlement Updates

### Routes that need changed checks:

| Route | Current Check | New Check |
|-------|--------------|-----------|
| `api/ai/draft-outreach` | `checkEntitlement("aiFeatures")` + `checkMonthlyQuota("ai_usage")` | `checkMonthlyQuota("email_draft" \| "linkedin_draft" \| "phone_draft")` based on `type` param |
| `api/ai/suggest-todos` | `checkEntitlement("aiFeatures")` + `checkMonthlyQuota("ai_usage")` | `checkMonthlyQuota("ai_task_suggest")` |
| `api/brand/enrich` | `checkEntitlement("aiFeatures")` + `checkMonthlyQuota("ai_usage")` | `checkMonthlyQuota("enrichment")` |
| `api/ai/enrich-company` | same | `checkMonthlyQuota("enrichment")` |
| `api/ai/enrich-person` | same | `checkMonthlyQuota("enrichment")` |
| `api/integrations/[provider]/connect` | `checkEntitlement("crm")` | `checkCrmEntitlement(userId, count)` |
| `api/integrations/sync/bulk` | `checkEntitlement("crm")` | Add `checkMonthlyQuota("bulk_push")` |
| `api/todos` POST | No check | Add `checkTaskEntitlement(userId, count)` |
| `api/ai/company-briefing` | Keep as `ai_usage` | Keep — general AI usage |
| `api/ai/analyze-pipeline` | Keep as `ai_usage` | Keep — general AI usage |
| `api/brand/enrich/questions` | `checkEntitlement("aiFeatures")` | Keep — no quota, just feature gate |

**Key change:** `aiFeatures` boolean is removed — FREE tier now has AI (5 usages/mo). Gates become quota-based, not boolean-based.

**Pattern for draft-outreach:**
```ts
// Map outreach type to specific quota feature
const draftFeatureMap: Record<string, MonthlyFeature> = {
  email: "email_draft",
  linkedin: "linkedin_draft",
  phone_script: "phone_draft",
};
const quota = await checkMonthlyQuota(userId, draftFeatureMap[type] ?? "email_draft");
```

---

## Phase 6: Client-Side Updates

### File: `lib/hooks/use-subscription.ts`
- Update plan type, expand limits/usage interfaces

### File: `app/settings/page.tsx`
- Replace 2-card upgrade grid with 4-tier pricing table
- Add monthly/annual toggle
- Show usage meters for all 9 monthly quotas
- Update plan names and colors

### File: `app/page.tsx` (landing page pricing section)
- Update pricing cards to show 4 tiers with new prices

---

## Deployment Sequence

| Day | Action | Risk | Rollback |
|-----|--------|------|----------|
| 0 | Create Stripe products/prices. Add env vars. Set `FF_NEW_PRICING=false`. Deploy code. | Low — flag is off, old logic runs | Remove env vars |
| 1 | Run Drizzle migration (0015). Set `FF_NEW_PRICING=true`. | Medium — plan names change | Run rollback SQL + set flag false |
| 2-7 | Monitor. Verify legacy webhook events resolve correctly. Check new quota tracking. | Low | Set flag false |
| 14 | Email legacy go/flow users about price reduction and new plan name. | Low | N/A |
| 30 | Remove feature flag. Remove legacy code paths. Archive old Stripe prices. | Low — all users migrated | Git revert |

---

## Security Checklist

- [ ] All quota checks are server-side in API routes (not client-only)
- [ ] `validPriceIds` in checkout route updated to include all 8 price IDs
- [ ] `priceToPlan()` returns `"free"` for any unknown price ID (fail-safe)
- [ ] Legacy go/flow price IDs continue resolving correctly via webhook
- [ ] CRM provider count enforced at connect time (not just UI)
- [ ] Task count enforced at creation time (new check)
- [ ] Draft quotas tracked per-type, not aggregated
- [ ] Enrichment quota separate from general AI usage
- [ ] Annual pricing discount baked into Stripe Price (not computed at runtime — prevents bypass)
- [ ] Batch quota check prevents N+1 queries on quota-heavy routes

---

## Cost Impact

| Metric | Before | After | Impact |
|--------|--------|-------|--------|
| ARPU | ~$37 (weighted) | ~$93 (weighted) | +151% per user |
| Stripe fees/user | ~$0.69 | ~$1.65 | Higher absolute, same % |
| Infra cost/user | ~$3.01 | ~$3.01 | No change |
| Gross margin | 91.6% | 96.8% | +5.2 pts |
| Break-even users | 234 | 93 | -60% (much easier) |

---

## Files to Modify (14 total)

| File | Change Type |
|------|-------------|
| `lib/feature-flags.ts` | **CREATE** — feature flag utility |
| `lib/stripe/plans.ts` | REWRITE — PlanId, PlanLimits, PLAN_LIMITS, priceToPlan |
| `lib/stripe/entitlements.ts` | EXPAND — MonthlyFeature, new checks, batch quota |
| `drizzle/0015_pricing_migration.sql` | **CREATE** — data migration |
| `app/api/stripe/checkout/route.ts` | UPDATE — validPriceIds |
| `app/api/stripe/change-plan/route.ts` | UPDATE — hierarchy, getPriceIdForPlan |
| `app/api/ai/draft-outreach/route.ts` | UPDATE — per-type draft quota |
| `app/api/ai/suggest-todos/route.ts` | UPDATE — ai_task_suggest quota |
| `app/api/ai/enrich-company/route.ts` | UPDATE — enrichment quota |
| `app/api/ai/enrich-person/route.ts` | UPDATE — enrichment quota |
| `app/api/brand/enrich/route.ts` | UPDATE — enrichment quota |
| `app/api/todos/route.ts` | UPDATE — add task count check |
| `lib/hooks/use-subscription.ts` | UPDATE — types, expanded usage |
| `app/settings/page.tsx` | UPDATE — 4-tier pricing UI |

---

## Verification

1. **Unit check:** Create a free user → verify 10 searches, 5 saves, 5 AI usages, 3 enrichments, 3 drafts (per type), 1 trigger, 5 tasks allowed
2. **Upgrade flow:** Free → Starter checkout → verify 50 searches, 25 saves, 10 AI usages
3. **Draft quota:** Generate 3 email drafts on free → 4th should return 403 with `upgrade: true`
4. **CRM gating:** Professional user connects HubSpot → verify 2nd CRM connection blocked
5. **Task cap:** Free user creates 5 tasks → 6th should return 403
6. **Legacy migration:** Existing `go` user → verify plan resolves to `professional` with full limits
7. **Webhook:** Simulate Stripe event with old GO price ID → verify resolves to `professional`
8. **Annual pricing:** Checkout with annual price ID → verify same PlanId as monthly
9. **Rollback:** Set `FF_NEW_PRICING=false` → verify old 3-tier logic resumes
10. **Batch quota:** Call API route that checks multiple quotas → verify only 2 DB queries (check with query logging)
