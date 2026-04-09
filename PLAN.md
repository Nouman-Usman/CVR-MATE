# CRM Integrations — Enterprise-Grade Implementation Plan

## Executive Summary

CVR-MATE has a solid CRM integration foundation (OAuth flows, encrypted tokens, sync mapping, audit logging) for HubSpot, Salesforce, and Pipedrive. However, critical gaps in entitlement enforcement, error handling, rate limiting, and UI polish prevent this from being production-ready. This plan upgrades the existing infrastructure to enterprise-grade quality across 6 phases.

---

## Current State Audit

### What Already Works
| Component | Status | Files |
|-----------|--------|-------|
| OAuth Connect/Callback/Disconnect | ✅ Complete | `app/api/integrations/[provider]/*` |
| Token Encryption (AES-256-GCM) | ✅ Complete | `lib/crm/encryption.ts` |
| Token Auto-Refresh (5-min buffer) | ✅ Complete | `lib/crm/token-manager.ts` |
| Single Company Push | ⚠️ Missing entitlement check | `app/api/integrations/sync/company/route.ts` |
| Bulk Company Push | ⚠️ Missing quota check | `app/api/integrations/sync/bulk/route.ts` |
| DB Schema (3 tables) | ✅ Complete | `db/app-schema.ts` |
| React Hooks (7 hooks) | ✅ Complete | `lib/hooks/use-integrations.ts` |
| Settings UI Component | ⚠️ Commented out, basic | `app/settings/page.tsx:497-656` |
| Plan Limits (0/0/1/3) | ✅ Defined | `lib/stripe/plans.ts` |
| Entitlement Engine | ✅ Complete | `lib/stripe/entitlements.ts` |

### Critical Security Gaps (Must Fix)
1. **`sync/company/route.ts`** — No entitlement check. Any user can push companies to CRM.
2. **`sync/bulk/route.ts`** — Checks `checkEntitlement("crm")` but never calls `checkMonthlyQuota("bulk_push")`. Monthly quota (0/0/30/∞) is never enforced.
3. **`connect/route.ts`** — Checks `checkEntitlement("crm")` but not `checkUsageEntitlement("crmConnections", count)`. Professional users (limit: 1) could connect all 3 providers.

### Architecture Gaps
1. No rate limiting against CRM provider API quotas
2. Bulk sync is sequential — no concurrency control
3. Pipedrive CVR field uses hardcoded hash (`7c039c49b0ed63688c4e8778db0e8d4b8a1e4b48`)
4. No retry mechanism for transient failures
5. No "Push to CRM" button on company detail or saved companies pages
6. No sync status indicators in the main app UI
7. No connection health monitoring

---

## Implementation Phases

### Phase 1: Security Hardening & Entitlement Enforcement
**Priority: CRITICAL — Must deploy first**
**Estimated effort: 1-2 hours**

#### 1.1 Fix Single Company Sync Entitlement
**File: `app/api/integrations/sync/company/route.ts`**

Add entitlement check after authentication (before line 19):
```ts
import { checkEntitlement } from "@/lib/stripe/entitlements";

// After session check:
const { allowed } = await checkEntitlement(session.user.id, "crm");
if (!allowed) {
  return NextResponse.json(
    { error: "CRM sync requires Professional or Enterprise plan", upgrade: true },
    { status: 403 }
  );
}
```

#### 1.2 Fix Bulk Sync Monthly Quota
**File: `app/api/integrations/sync/bulk/route.ts`**

Replace existing `checkEntitlement` with both entitlement AND quota check:
```ts
import { checkEntitlement, checkMonthlyQuota, recordUsage } from "@/lib/stripe/entitlements";

// After session check:
const { allowed: crmAllowed } = await checkEntitlement(session.user.id, "crm");
if (!crmAllowed) {
  return NextResponse.json({ error: "CRM requires Professional or Enterprise plan", upgrade: true }, { status: 403 });
}

const quota = await checkMonthlyQuota(session.user.id, "bulk_push");
if (!quota.allowed) {
  return NextResponse.json({
    error: `Monthly bulk push limit reached (${quota.used}/${quota.limit})`,
    upgrade: true,
    usage: { used: quota.used, limit: quota.limit },
  }, { status: 429 });
}

// After successful sync loop, record one usage event per company pushed:
for (const result of results.filter(r => r.status === "success")) {
  await recordUsage(session.user.id, "bulk_push");
}
```

#### 1.3 Fix Connection Limit Enforcement
**File: `app/api/integrations/[provider]/connect/route.ts`**

After `checkEntitlement`, add connection count check:
```ts
import { checkUsageEntitlement } from "@/lib/stripe/entitlements";

// Count existing active connections
const activeConnections = await db.query.crmConnection.findMany({
  where: and(
    eq(crmConnection.userId, session.user.id),
    eq(crmConnection.isActive, true)
  ),
});

// Check if user can add another connection
const { allowed: canAdd, limit } = await checkUsageEntitlement(
  session.user.id,
  "crmConnections",
  activeConnections.length
);

// Allow reconnecting to the same provider (re-auth)
const isReconnect = activeConnections.some(c => c.provider === provider);
if (!canAdd && !isReconnect) {
  return NextResponse.json({
    error: `Your plan allows ${limit} CRM connection(s). Disconnect an existing one first.`,
    upgrade: true,
    limit,
    current: activeConnections.length,
  }, { status: 403 });
}
```

#### 1.4 Add Rate Limiting Helper
**New file: `lib/crm/rate-limiter.ts`**

Simple in-memory sliding window rate limiter for CRM API calls:
```ts
// Per-provider rate limits:
// HubSpot: 100 requests / 10 seconds
// Salesforce: 100 requests / 15 seconds (varies by edition)
// Pipedrive: 80 requests / 2 seconds
```

Use Upstash Redis for distributed rate limiting (already in the stack):
- Key pattern: `crm:rate:{userId}:{provider}`
- TTL matches provider window
- Check before each CRM API call in provider clients

---

### Phase 2: Enhanced CRM Provider Clients
**Priority: HIGH — Reliability improvements**
**Estimated effort: 2-3 hours**

#### 2.1 Add Retry Logic with Exponential Backoff
**New file: `lib/crm/retry.ts`**

```ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number; retryableStatuses: number[] }
): Promise<T>
```

- Default: 3 retries, 1s base delay, retry on 429/500/502/503/504
- Applied to all CRM client methods (createCompany, updateCompany, findCompanyByVat)
- Log retries to console for observability

#### 2.2 Improve Error Classification
**Update: `lib/crm/providers/*.ts`**

Create typed error classes:
```ts
export class CrmApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public provider: CrmProvider,
    public retryable: boolean
  ) { super(message); }
}

export class CrmAuthError extends CrmApiError { }  // 401/403 — token issues
export class CrmRateLimitError extends CrmApiError { }  // 429 — rate limited
export class CrmNotFoundError extends CrmApiError { }  // 404 — entity not found
```

Benefits: The sync routes can differentiate between "retry later" (rate limit) vs. "fix config" (auth) vs. "data issue" (not found).

#### 2.3 Fix Pipedrive Custom Field
**Update: `lib/crm/providers/pipedrive.ts`**

Replace hardcoded hash with dynamic field discovery:
```ts
// On first sync, find or create the CVR custom field
// Cache the field key per connection in Redis (24h TTL)
// Fallback: search organizations by name if CVR field not found
```

#### 2.4 Add Connection Health Check
**New file: `lib/crm/health.ts`**

```ts
export async function checkConnectionHealth(connectionId: string): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}>
```

- Makes a lightweight read-only API call (e.g., GET /me or list 1 record)
- Called when user views integrations settings
- Updates `lastRefreshedAt` on success
- Marks connection inactive on permanent failure (expired refresh token)

---

### Phase 3: Settings UI — Enterprise-Grade Integration Panel
**Priority: HIGH — User-facing experience**
**Estimated effort: 3-4 hours**

#### 3.1 Extract & Rebuild CrmIntegrationsSection
**New file: `components/settings/crm-integrations-section.tsx`**

Extract from `app/settings/page.tsx` (lines 497-656) into standalone component. Complete redesign:

```
┌─────────────────────────────────────────────────────────┐
│  CRM Integrations                                        │
│  Connect your CRM to push Danish company data directly   │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │  [HubSpot]   │ │ [Salesforce] │ │ [Pipedrive]  │    │
│  │  ● Connected │ │  ○ Connect   │ │  ○ Connect   │    │
│  │  Last sync:  │ │              │ │              │    │
│  │  2 hours ago │ │  Pro+ only   │ │  Pro+ only   │    │
│  │              │ │              │ │              │    │
│  │ [Disconnect] │ │  [Upgrade]   │ │  [Upgrade]   │    │
│  │ [Test]       │ │              │ │              │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                          │
│  Connection Limit: 1/1 used (Professional)               │
│  Bulk Push Quota: 12/30 used this period                 │
│                                                          │
│  ┌─ Recent Sync Activity ──────────────────────────────┐ │
│  │  ✅ Acme ApS → HubSpot          2 min ago          │ │
│  │  ✅ Nordic Tech → HubSpot       5 min ago          │ │
│  │  ❌ Dansk A/S → HubSpot (429)   8 min ago  [Retry] │ │
│  │  ✅ CVR Corp → HubSpot         12 min ago          │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

Key UI elements:
- **Plan-gated cards**: Free/Starter see disabled cards with "Upgrade to Professional" CTA
- **Connection limit meter**: Shows `{used}/{limit} connections` with progress bar
- **Bulk push quota meter**: Shows `{used}/{limit} pushes this month`
- **Health indicator**: Green/yellow/red dot on each connected provider
- **Test Connection button**: Calls health check endpoint
- **Retry button on failed syncs**: Re-triggers individual sync
- **Disconnect confirmation**: AlertDialog with warning about sync history

#### 3.2 Plan-Gating UI Logic

```ts
// Inside the component:
const { data: sub } = useSubscription();
const plan = sub?.plan ?? "free";
const crmLimit = sub?.limits?.crmConnections ?? 0;
const bulkPushUsage = sub?.usage?.bulkPush ?? { used: 0, limit: 0 };

const canUseCrm = crmLimit > 0; // Professional or Enterprise
const canBulkPush = bulkPushUsage.limit > 0;
```

For Free/Starter users:
- Show provider cards in disabled/muted state
- Overlay with lock icon and "Available on Professional" badge
- "Upgrade" button links to subscription section

#### 3.3 Un-comment and Wire Up in Settings
**File: `app/settings/page.tsx`**

1. Un-comment the integrations tab in the sidebar navigation
2. Un-comment the `CrmIntegrationsSection` render
3. Import the new extracted component
4. Add tab routing for `?tab=integrations` (used by OAuth callback redirect)

---

### Phase 4: Push-to-CRM in Main App UI
**Priority: MEDIUM — Feature completeness**
**Estimated effort: 2-3 hours**

#### 4.1 Company Detail Page — CRM Push Button
**File: `app/company/[id]/page.tsx`** (or wherever saved company detail lives)

Add a "Push to CRM" dropdown button:
```
[Push to CRM ▾]
  → HubSpot    ✅ Synced (2h ago)
  → Salesforce  ○ Not connected
  → Pipedrive   ○ Not connected
```

- Only visible for Professional/Enterprise plans
- Shows sync status per connected provider
- Clicking triggers `usePushToCrm` mutation
- Shows toast on success/error

#### 4.2 Saved Companies Page — Bulk Actions
**Update saved companies list/table**

Add CRM column and bulk action:
- Sync status icon per row (●/○/⚠)
- Checkbox selection → "Push to CRM" bulk action button
- Progress indicator during bulk sync
- Results summary toast: "12 synced, 2 failed"

#### 4.3 Context Menu Integration
**Update existing context menus**

Add "Push to CRM → [Provider]" option to company context menus (right-click or action dropdown). Only visible when user has active CRM connections.

---

### Phase 5: Sync History & Analytics Dashboard
**Priority: MEDIUM — Observability**
**Estimated effort: 1-2 hours**

#### 5.1 Enhanced Sync History in Settings
**Update: `components/settings/crm-integrations-section.tsx`**

- Paginated sync log table (not just last 8)
- Filter by: provider, status (success/error/skipped), date range
- Expandable rows showing error details and metadata
- Export sync logs as CSV

#### 5.2 Sync Summary Stats

Add summary cards at top of integrations section:
```
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   Total Synced │ │  Failed Today  │ │  Last Sync     │
│      127       │ │      3         │ │  2 min ago     │
└───────────────┘ └───────────────┘ └───────────────┘
```

#### 5.3 Add Sync History API Endpoint Improvements
**File: `app/api/integrations/sync/history/route.ts`**

Add query parameters:
- `provider` — filter by provider
- `status` — filter by status
- `from` / `to` — date range filter
- `search` — search by company name in metadata

---

### Phase 6: Advanced Features (Future)
**Priority: LOW — Post-launch enhancements**

These are deferred to post-launch. Listed here for architecture awareness:

1. **Bidirectional Sync (Pull from CRM)**
   - Webhook receivers for CRM events
   - Conflict resolution strategy (last-write-wins with manual override)
   - Schema: `syncDirection` column already supports "pull" and "bidirectional"

2. **Custom Field Mapping UI**
   - Let users map CVR-MATE fields → CRM fields
   - New `crmFieldMapping` table
   - Per-connection configuration

3. **Scheduled Auto-Sync**
   - QStash cron job to sync updated companies
   - Configurable sync frequency (daily/weekly)
   - Only syncs companies that changed since last sync

4. **CRM Webhooks (Inbound)**
   - HubSpot: Webhook subscriptions API
   - Salesforce: Platform Events / Streaming API
   - Pipedrive: Webhooks API
   - Updates sync mapping when CRM records change

5. **Sync Queue with Dead Letter**
   - Failed syncs queue to Upstash QStash
   - Automatic retry (3 attempts, exponential backoff)
   - Dead letter queue for manual review

---

## File Change Map

### New Files
| File | Purpose |
|------|---------|
| `components/settings/crm-integrations-section.tsx` | Rebuilt integrations UI panel |
| `lib/crm/retry.ts` | Retry utility with exponential backoff |
| `lib/crm/errors.ts` | Typed CRM error classes |
| `lib/crm/rate-limiter.ts` | Redis-based per-provider rate limiter |
| `lib/crm/health.ts` | Connection health check utility |
| `app/api/integrations/health/route.ts` | Health check API endpoint |

### Modified Files
| File | Changes |
|------|---------|
| `app/api/integrations/[provider]/connect/route.ts` | Add connection limit check |
| `app/api/integrations/sync/company/route.ts` | Add entitlement check, use retry |
| `app/api/integrations/sync/bulk/route.ts` | Add monthly quota check, record usage |
| `app/api/integrations/sync/history/route.ts` | Add filtering query params |
| `app/settings/page.tsx` | Un-comment integrations, import new component |
| `lib/crm/providers/hubspot.ts` | Add retry, better errors |
| `lib/crm/providers/salesforce.ts` | Add retry, better errors |
| `lib/crm/providers/pipedrive.ts` | Fix custom field, add retry |
| `lib/crm/index.ts` | Integrate rate limiter |
| `lib/hooks/use-integrations.ts` | Add health check hook, quota display |

### No Schema Changes Required
The existing `crmConnection`, `crmSyncMapping`, and `crmSyncLog` tables already support everything in Phases 1-5. The schema was designed with forward-looking fields (`syncDirection`, `version`, `lastRemoteUpdate`, `syncStatus: "conflict"`).

---

## Environment Variables Required

Already configured (from existing setup):
```env
# CRM OAuth (per provider)
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=

# Token encryption
CRM_TOKEN_ENCRYPTION_KEY=  # 32-byte hex string for AES-256-GCM
```

No new env vars required for Phases 1-5.

---

## Execution Order

```
Phase 1 (CRITICAL)  →  Phase 2 (HIGH)  →  Phase 3 (HIGH)  →  Phase 4 (MEDIUM)  →  Phase 5 (MEDIUM)
Security fixes         Provider reliability  Settings UI         App-wide CRM UI      Analytics
~1-2 hours             ~2-3 hours            ~3-4 hours          ~2-3 hours            ~1-2 hours
```

**Total estimated effort: 10-14 hours across 5 active phases.**

Phase 6 is deferred and should be planned separately after initial launch feedback.

---

## Cross-Check Verification

### Security Cross-Check ✅
- [x] All sync endpoints enforce plan entitlements
- [x] Connection count limited per plan tier
- [x] Monthly bulk push quota enforced and tracked
- [x] OAuth tokens encrypted at rest (AES-256-GCM)
- [x] CSRF protection on OAuth flows (httpOnly state cookie)
- [x] Connection ownership verified on every API call
- [x] Soft-delete on disconnect (preserves audit trail)
- [x] Rate limiting prevents CRM API abuse

### Data Integrity Cross-Check ✅
- [x] VAT-based deduplication prevents duplicate CRM records
- [x] Sync mapping tracks local↔remote entity pairs
- [x] Version counter prevents stale update overwrites (Phase 6)
- [x] Audit log captures every sync operation with status
- [x] Token refresh failure auto-marks connection inactive

### Plan Tier Cross-Check ✅
- [x] Free: 0 CRM connections, 0 bulk push → fully blocked
- [x] Starter: 0 CRM connections, 0 bulk push → fully blocked
- [x] Professional: 1 connection, 30 bulk pushes/month → properly limited
- [x] Enterprise: 3 connections, unlimited bulk pushes → properly gated
- [x] UI shows plan-appropriate messaging and upgrade CTAs
- [x] Reconnecting same provider doesn't count toward limit

### Backward Compatibility Cross-Check ✅
- [x] No schema migrations required (existing tables sufficient)
- [x] Existing hooks maintain same API contract
- [x] OAuth callback redirect URL pattern unchanged
- [x] Legacy `checkEntitlement("crm")` still works via LEGACY_FEATURE_MAP
