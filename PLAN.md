# Pipedrive CRM Integration — Setup Guide & Production Plan

## Context

The Pipedrive integration code is **already fully implemented** — OAuth flow, token management, rich push (company + contacts + notes + enrichment), custom field discovery, health checks, retry logic, and UI are all in place. The codebase uses a provider-agnostic `CrmClient` interface that HubSpot, Salesforce, and Pipedrive all implement identically.

**The only blocker is environment configuration**: Pipedrive OAuth credentials need to be created in the Pipedrive Developer Hub and added to `.env`. This plan provides the complete setup guide, a code hardening pass for two minor issues, and a full verification checklist.

---

## Part A: Pipedrive Developer App Setup Guide

### Step 1: Create a Pipedrive Developer App

1. Go to **https://developers.pipedrive.com/** and sign in with your Pipedrive account
2. Click **"Create an app"** in the Developer Hub
3. Select **"Create private app"** (for internal use — no Marketplace listing needed)
4. Fill in:
   - **App name**: `CVR-MATE`
   - **Description**: `CRM sync for Danish company data, contacts, and AI enrichment`

### Step 2: Configure OAuth & Callback URL

Under the **"OAuth & Access scopes"** tab:

1. Set the **Callback URL(s)**:
   - Local dev: `http://localhost:3000/api/integrations/pipedrive/callback`
   - Production: `https://YOUR_PRODUCTION_DOMAIN/api/integrations/pipedrive/callback`
   - (Pipedrive allows multiple callback URLs — add both)

2. Enable these **scopes** in the Developer Hub UI:
   - `contacts:full` — read/write organizations and persons
   - `admin` — required for custom field creation via API
   - (Note: scopes are configured in the Developer Hub, NOT in the OAuth URL. The code correctly sends an empty `scopes` param since Pipedrive handles this server-side.)

### Step 3: Copy Credentials

After saving, the app details page shows:
- **Client ID** — copy this
- **Client Secret** — copy this (won't be shown again if regenerated)

### Step 4: Add to Environment

Add to your `.env` file:
```bash
PIPEDRIVE_CLIENT_ID=<your_client_id_here>
PIPEDRIVE_CLIENT_SECRET=<your_client_secret_here>
```

These vars are already listed in `.env.example` (lines 21-22) but are currently empty.

**Already set** (no action needed):
- `CRM_TOKEN_ENCRYPTION_KEY` — 32-byte hex key for AES-256-GCM token encryption (shared across all CRM providers)

### Step 5: Production Deployment (Vercel)

```bash
# Add secrets to Vercel (mark as Sensitive)
vercel env add PIPEDRIVE_CLIENT_ID production
vercel env add PIPEDRIVE_CLIENT_SECRET production

# Verify these are also set:
# - CRM_TOKEN_ENCRYPTION_KEY (same value as local — MUST match to decrypt tokens)
# - NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL (used for OAuth redirect URI)
```

---

## Part B: Code Hardening (2 Issues Found During Audit)

### Issue 1 (Medium): `findCompanyByVat` can return false positives

**File**: `lib/crm/providers/pipedrive.ts` — `findCompanyByVat()` method

**Problem**: The Pipedrive search endpoint `GET /v1/organizations/search?term={vat}&fields=custom_fields` does full-text search across ALL custom field values. A VAT like `12345678` could match an organization whose phone custom field contains that number.

**Fix**: After finding a match, read back the organization and verify the CVR custom field value actually equals the searched VAT.

### Issue 2 (Low): `ensureFields` makes 6 sequential API calls

**File**: `lib/crm/providers/pipedrive.ts` — `ensureFields()` method

**Problem**: Each of the 6 custom fields calls `GET /v1/organizationFields` separately. Since the field list is the same for all org fields, we should fetch it once and reuse.

**Fix**: Fetch all org fields in 1 call and all person fields in 1 call (2 GETs instead of 6), then check/create only missing ones.

---

## Part C: Architecture Overview (What Already Exists)

### Files involved (all already implemented):

| File | Purpose |
|------|---------|
| `lib/crm/types.ts` | `CrmClient` interface, `CrmProviderConfig` for Pipedrive |
| `lib/crm/providers/pipedrive.ts` | Full provider: org/person/note CRUD, custom field discovery |
| `lib/crm/index.ts` | Client factory: `createPipedriveClient(accessToken)` |
| `lib/crm/token-manager.ts` | Token refresh (Pipedrive rotates refresh tokens on each use) |
| `lib/crm/encryption.ts` | AES-256-GCM token encryption |
| `lib/crm/health.ts` | Health check: `GET /v1/users/me` |
| `lib/crm/errors.ts` | Error classification (401->auth, 429->rate limit, 404->not found) |
| `lib/crm/retry.ts` | Exponential backoff with Retry-After awareness |
| `lib/crm/rich-push.ts` | Orchestrator: company + contacts + enrichment note + user notes |
| `lib/crm/format-enrichment.ts` | HTML note formatters for AI enrichment |
| `app/api/integrations/[provider]/connect/route.ts` | OAuth initiation (generic, handles all providers) |
| `app/api/integrations/[provider]/callback/route.ts` | OAuth callback + token exchange |
| `app/api/integrations/[provider]/disconnect/route.ts` | Soft disconnect (sets isActive=false) |
| `app/api/integrations/sync/company/route.ts` | Single company rich push |
| `app/api/integrations/sync/bulk/route.ts` | Bulk rich push (max 100, 200ms delay) |
| `app/api/integrations/sync/status/route.ts` | Sync status per company |
| `app/api/integrations/sync/history/route.ts` | Paginated sync audit log |
| `components/settings/crm-integrations-section.tsx` | UI: connect/disconnect/health/push |

### Data pushed on rich push:

| Entity | Pipedrive Object | Fields |
|--------|-----------------|--------|
| Company | Organization | name, address, CVR Number, Capital, Tags, Lead Grade |
| Contacts (up to 25) | Person | name, job_title, org_id, CVR Participant Number, CVR Roles |
| AI Enrichment | Note (on org) | HTML-formatted intelligence brief |
| User Notes | Note (on org) | Concatenated user notes with timestamps |

### Pipedrive-specific behaviors:
- **Custom fields use hash IDs** — discovered at runtime via `/v1/organizationFields` and `/v1/personFields`, cached per session
- **Person -> Organization linking** — via `org_id` field (no separate association API)
- **Notes** — attached via `org_id` on creation, support HTML content
- **Token refresh** — Pipedrive issues a **new refresh token on every refresh** (old one invalidated). Code handles this correctly in `token-manager.ts`.
- **Access tokens expire in 1 hour** — auto-refreshed 5 minutes before expiry
- **Scopes** — configured in Developer Hub, not in OAuth URL. Code sends empty `scopes` param.

---

## Part D: Verification Checklist

### Phase A: OAuth Flow
1. Navigate to Settings -> Integrations
2. Click "Connect Pipedrive" -> verify redirect to `oauth.pipedrive.com`
3. Authorize the app
4. Verify redirect back to `/settings?tab=integrations&connected=pipedrive`
5. Verify Pipedrive card shows "Connected" with date
6. Check DB: `crmConnection` row with `provider=pipedrive`, `isActive=true`

### Phase B: Health Check
7. Click "Test Connection" on Pipedrive card
8. Verify green status with latency in ms

### Phase C: Single Company Push
9. Save a company with a Danish CVR number
10. Push to Pipedrive via sync button
11. Verify in Pipedrive: Organization created with name, address, CVR Number custom field
12. Push same company again -> verify update (no duplicate)

### Phase D: Rich Push (Contacts + Notes)
13. Push a company that has participants (directors, owners)
14. Verify in Pipedrive: Persons created and linked to Organization
15. Verify custom fields: "CVR Participant Number", "CVR Roles" populated
16. Verify enrichment note attached to Organization (if AI enrichment exists)
17. Verify user notes (if any) as separate note

### Phase E: Bulk Push
18. Select multiple companies -> trigger bulk push
19. Verify all companies + contacts appear in Pipedrive
20. Monitor logs for rate limit errors

### Phase F: Token Refresh
21. Wait 1 hour (or set `tokenExpiresAt` to past in DB)
22. Trigger sync -> verify auto-refresh (check `lastRefreshedAt`)
23. Verify new refresh token stored (Pipedrive rotates them)

### Phase G: Disconnect/Reconnect
24. Click Disconnect -> confirm -> verify Connect button returns
25. Reconnect -> verify new token stored, connection reactivated

---

## Part E: Known Pipedrive API Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| **Rate limit**: 80 req/2s (all plans) | Bulk push of 50+ companies may hit limits | 200ms inter-company delay + exponential backoff on 429 |
| **Daily limit**: 8,000 req/token (Essential/Advanced) | ~400 rich pushes/day (each uses ~20 calls) | Monitor usage, upgrade Pipedrive plan if needed |
| **Custom fields**: ~400 max per entity type | CVR-MATE uses 4 org + 2 person fields | Well within limits |
| **No person-level notes** | Notes only attach to organizations | Acceptable — enrichment data on company level |
| **Search is full-text, not exact match** | VAT search could match other fields | Issue 1 fix adds verification step |
| **Access tokens expire in 1 hour** | Frequent refresh needed | Auto-refresh with 5-min buffer already implemented |
| **Refresh tokens are single-use** | Must store new refresh token on every refresh | Already handled in `token-manager.ts` |

---

## Implementation Order

1. **Add env vars** — `PIPEDRIVE_CLIENT_ID` + `PIPEDRIVE_CLIENT_SECRET` to `.env`
2. **Apply Issue 1 fix** — verify VAT match after search in `findCompanyByVat`
3. **Apply Issue 2 fix** — batch field discovery in `ensureFields`
4. **Test locally** — run through Phases A-G of verification checklist
5. **Deploy to Vercel** — add env vars, verify callback URL includes production domain
6. **Test production** — re-run verification checklist against production

---

## Critical Files to Modify

1. **EDIT** `lib/crm/providers/pipedrive.ts` — fix `findCompanyByVat` false positives + optimize `ensureFields`
2. **ADD** `.env` values — `PIPEDRIVE_CLIENT_ID`, `PIPEDRIVE_CLIENT_SECRET`
3. **VERIFY** Vercel env vars match local (especially `CRM_TOKEN_ENCRYPTION_KEY`)
