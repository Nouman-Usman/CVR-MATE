# GoHighLevel (GHL) CRM Integration — Setup Guide & Production Plan

## Context

**Replacing Salesforce with GoHighLevel (GHL)** as the third CRM provider alongside HubSpot and Pipedrive. GHL is a better fit for CVR-MATE's SMB/agency target market:

- **Custom fields are API-creatable** (like HubSpot) — no manual admin setup
- **Simpler OAuth** — standard authorization_code, no `prompt=consent` hack, no `instance_url` routing
- **REST-based search** — no SOQL queries
- **Higher rate limits** — 200K/day + 100 req/10s burst
- **Growing user base** — very popular with agencies and SMBs

**What needs to happen**:
1. Replace `salesforce` provider with `leadconnector` across the codebase
2. Create the GHL provider implementation (`lib/crm/providers/leadconnector.ts`)
3. Update types, client factory, health checks, UI, and OAuth config
4. Set up GHL Marketplace app for OAuth credentials

### GHL API Summary (from [official docs](https://marketplace.gohighlevel.com/docs/)):

| Detail | Value |
|--------|-------|
| **Base URL** | `https://services.leadconnectorhq.com` |
| **Auth URL** | `https://marketplace.gohighlevel.com/oauth/chooselocation` |
| **Token URL** | `https://services.leadconnectorhq.com/oauth/token` |
| **API version header** | `Version: 2021-07-28` |
| **Token expiry** | ~24 hours (86,399 seconds) |
| **Refresh tokens** | Single-use (new one issued on every refresh, like Pipedrive) |
| **Rate limits** | 100 req/10s burst, 200K/day per app per resource |
| **Contacts** | `POST/PUT/GET /contacts/` with `locationId` required |
| **Custom fields** | API-creatable via `/locations/{locationId}/customFields` |
| **Notes** | Via `POST /contacts/{contactId}/notes` (contact-level) |
| **Search** | `GET /contacts/search?query=...&locationId=...` |

---

## Part A: GHL Marketplace App Setup Guide

### Step 1: Create a GHL Developer Account

1. Go to **https://marketplace.gohighlevel.com/** and sign in
2. Click **"My Apps"** → **"Create App"**
3. Select **"Private App"** (for internal use) or **"Public App"** if distributing
4. Fill in:
   - **App Name**: `CVR-MATE`
   - **Description**: `Danish CRM sync for company data, contacts, and AI enrichment`

### Step 2: Configure OAuth & Scopes

Under the **"Settings"** tab of your app:

1. Set the **Redirect URI(s)**:
   - Local dev: `http://localhost:3000/api/integrations/leadconnector/callback`
   - Production: `https://YOUR_PRODUCTION_DOMAIN/api/integrations/leadconnector/callback`

2. Enable these **scopes**:
   - `contacts.write` — create/update contacts
   - `contacts.readonly` — search/read contacts
   - `businesses.write` — create/update businesses (company-level data)
   - `businesses.readonly` — read businesses
   - `locations/customFields.write` — auto-create custom fields
   - `locations/customFields.readonly` — read custom fields
   - `locations.readonly` — access location details (needed for locationId)

3. Set **Distribution Type**: `Sub-Account` (Location level access)

### Step 3: Copy Credentials

After saving, the app page shows:
- **Client ID** — copy this
- **Client Secret** — copy this

### Step 4: Add to Environment

Add to your `.env` file:
```bash
LEADCONNECTOR_CLIENT_ID=<your_client_id_here>
LEADCONNECTOR_CLIENT_SECRET=<your_client_secret_here>
```

**Already set** (no action needed):
- `CRM_TOKEN_ENCRYPTION_KEY` — shared across all CRM providers

### Step 5: Production Deployment (Vercel)

```bash
vercel env add LEADCONNECTOR_CLIENT_ID production
vercel env add LEADCONNECTOR_CLIENT_SECRET production
```

---

## Part B: Code Changes Required

Unlike Pipedrive (which was already implemented), GHL requires **new code** to replace Salesforce.

### B1. Update `lib/crm/types.ts`

Replace the `salesforce` provider config:

```typescript
// REMOVE salesforce, ADD leadconnector
export type CrmProvider = "hubspot" | "leadconnector" | "pipedrive";

// In CRM_PROVIDERS:
leadconnector: {
  name: "LeadConnector",
  icon: "rocket_launch",
  color: "#FF6B35",
  authUrl: "https://marketplace.gohighlevel.com/oauth/chooselocation",
  tokenUrl: "https://services.leadconnectorhq.com/oauth/token",
  scopes: "contacts.write contacts.readonly businesses.write businesses.readonly locations/customFields.write locations/customFields.readonly locations.readonly",
  clientIdEnv: "LEADCONNECTOR_CLIENT_ID",
  clientSecretEnv: "LEADCONNECTOR_CLIENT_SECRET",
},
```

### B2. Create `lib/crm/providers/leadconnector.ts`

New provider implementing the full `CrmClient` interface:

**Base URL**: `https://services.leadconnectorhq.com`

**Required headers on ALL requests**:
```typescript
{
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
  Version: "2021-07-28",
}
```

**Key difference from other providers**: GHL requires `locationId` on every contact/custom-field operation. The `locationId` is returned in the OAuth token response and must be stored (use the `instanceUrl` column in `crmConnection` to store it — same pattern as Salesforce).

**Company mapping** — GHL uses "contacts" as the primary entity (not a separate Company object). A company is represented as a contact with `companyName` set:

| CVR-MATE Field | GHL Contact Field |
|---------------|-------------------|
| `name` | `companyName` |
| `vat` | custom field (auto-created) |
| `phone` | `phone` |
| `email` | `email` |
| `website` | `website` |
| `address` | `address1` |
| `city` | `city` |
| `zipcode` | `postalCode` |
| `tags` | `tags` (array) |

**Contact mapping** — People pushed as separate contacts linked via `companyName`:

| CVR-MATE Field | GHL Contact Field |
|---------------|-------------------|
| `firstName` | `firstName` |
| `lastName` | `lastName` |
| `jobTitle` | custom field |
| `roles` | custom field |
| `participantNumber` | custom field |

**Custom fields** — auto-created via API:
- `POST /locations/{locationId}/customFields` with `{ name, dataType: "TEXT", model: "contact" }`
- Fields to create: `CVR Number`, `Job Title`, `CVR Roles`, `CVR Participant Number`

**Search/dedup** — find existing contacts:
- `GET /contacts/search?query={vat}&locationId={locationId}` for company by VAT
- `GET /contacts/search?query={name}&locationId={locationId}` for person by name

**Notes** — attached to contacts:
- `POST /contacts/{contactId}/notes` with `{ body: "..." }`

### B3. Update `lib/crm/index.ts`

Replace the Salesforce case:
```typescript
case "leadconnector":
  if (!tokens.instanceUrl) throw new Error("GHL connection missing locationId");
  return createLeadConnectorClient(tokens.accessToken, tokens.instanceUrl); // instanceUrl stores locationId
```

### B4. Update `lib/crm/health.ts`

Replace the Salesforce health check:
```typescript
case "leadconnector":
  healthUrl = "https://services.leadconnectorhq.com/locations/" + tokens.instanceUrl;
  // Use locationId from instanceUrl column
  break;
```

### B5. Update `lib/crm/rich-push.ts`

Replace `salesforce` entity type mapping:
```typescript
leadconnector: { company: "contact", contact: "contact", note: "note" },
```

### B6. Update OAuth callback (`app/api/integrations/[provider]/callback/route.ts`)

GHL returns `locationId` in the token response. Store it in the `instanceUrl` column:
```typescript
if (provider === "leadconnector") {
  instanceUrl = tokenData.locationId; // Store locationId for API calls
}
```

### B7. Update OAuth connect (`app/api/integrations/[provider]/connect/route.ts`)

Remove the Salesforce `prompt=consent` special case (GHL doesn't need it).

### B8. Update Settings UI (`components/settings/crm-integrations-section.tsx`)

Replace the Salesforce card:
```typescript
{
  provider: "leadconnector",
  name: "LeadConnector",
  color: "#FF6B35",
  icon: "rocket_launch",
  desc: "Push leads to LeadConnector CRM",
  descDa: "Send leads til LeadConnector CRM",
}
```

### B9. Update `.env.example`

Replace `SALESFORCE_*` vars with `LEADCONNECTOR_*`:
```
LEADCONNECTOR_CLIENT_ID=
LEADCONNECTOR_CLIENT_SECRET=
```

### B10. Database consideration

No migration needed — the `crmConnection` table already supports:
- `provider: text` — free-text, just stores `"leadconnector"` instead of `"salesforce"`
- `instanceUrl: text` — reused to store GHL's `locationId`
- Existing Salesforce connections in the DB will remain but become inert (no matching provider code)

---

## Part C: Architecture Overview

### Files to create/modify:

| File | Action | Details |
|------|--------|---------|
| `lib/crm/providers/leadconnector.ts` | **CREATE** | Full CrmClient: contact CRUD, notes, custom fields |
| `lib/crm/providers/salesforce.ts` | **DELETE** | No longer needed |
| `lib/crm/types.ts` | **EDIT** | Replace `salesforce` with `leadconnector` in CrmProvider and CRM_PROVIDERS |
| `lib/crm/index.ts` | **EDIT** | Replace Salesforce case with GHL client factory |
| `lib/crm/health.ts` | **EDIT** | Replace Salesforce health endpoint |
| `lib/crm/rich-push.ts` | **EDIT** | Replace `salesforce` entity mapping |
| `app/api/integrations/[provider]/connect/route.ts` | **EDIT** | Remove `prompt=consent` Salesforce special case |
| `app/api/integrations/[provider]/callback/route.ts` | **EDIT** | Extract `locationId` for GHL, remove Salesforce `instance_url` handling |
| `lib/crm/token-manager.ts` | **EDIT** | Remove Salesforce instance_url token endpoint logic |
| `components/settings/crm-integrations-section.tsx` | **EDIT** | Replace Salesforce card with GHL card |
| `.env.example` | **EDIT** | Replace `SALESFORCE_*` with `LEADCONNECTOR_*` |

### Data pushed on rich push:

| Entity | GHL Object | Fields |
|--------|-----------|--------|
| Company | Contact (with companyName) | companyName, phone, email, website, address1, city, postalCode, tags, CVR Number (custom field) |
| People (up to 25) | Contact | firstName, lastName, custom fields (Job Title, CVR Roles, Participant Number) |
| AI Enrichment | Note (on company contact) | HTML body (GHL notes support HTML) |
| User Notes | Note (on company contact) | Concatenated notes with timestamps |

### GHL-specific behaviors:
- **Companies are contacts** — GHL doesn't have a separate Company/Account object. Companies are represented as contacts with `companyName` populated
- **locationId required** — every API call needs the `locationId` query param or in the body
- **Custom fields auto-created** — via `/locations/{locationId}/customFields` (like HubSpot, unlike Salesforce)
- **Version header required** — `Version: 2021-07-28` on all requests
- **Token expiry ~24 hours** — much longer than Pipedrive (1hr) or Salesforce (2hr)
- **Refresh tokens single-use** — new one on every refresh (like Pipedrive)
- **Notes support HTML** — no stripping needed (unlike Salesforce)

---

## Part D: Verification Checklist

### Phase A: OAuth Flow
1. Navigate to Settings -> Integrations
2. Click "Connect LeadConnector" -> verify redirect to location chooser
3. Select a location (sub-account) and authorize
4. Verify redirect back to `/settings?tab=integrations&connected=leadconnector`
5. Verify LeadConnector card shows "Connected" with date
6. Check DB: `crmConnection` row with `provider=leadconnector`, `isActive=true`, `instanceUrl` = locationId

### Phase B: Health Check
7. Click "Test Connection" on LeadConnector card
8. Verify green status with latency in ms

### Phase C: Single Company Push
9. Save a company with a Danish CVR number
10. Push to LeadConnector via sync button
11. Verify in LeadConnector: Contact created with companyName, address, CVR Number custom field
12. Push same company again -> verify update (no duplicate)

### Phase D: Rich Push (Contacts + Notes)
13. Push a company that has participants
14. Verify in LeadConnector: Person contacts created with firstName, lastName
15. Verify custom fields: Job Title, CVR Roles populated
16. Verify enrichment note attached to company contact
17. Verify user notes as separate note

### Phase E: Bulk Push
18. Select multiple companies -> trigger bulk push
19. Verify all companies + contacts appear in LeadConnector
20. Monitor for rate limit errors (100 req/10s)

### Phase F: Token Refresh
21. Wait 24 hours (or set `tokenExpiresAt` to past in DB)
22. Trigger sync -> verify auto-refresh
23. Verify new refresh token stored (GHL rotates them, like Pipedrive)

### Phase G: Disconnect/Reconnect
24. Click Disconnect -> confirm -> verify Connect button returns
25. Reconnect -> verify new token stored, locationId updated

---

## Part E: Known GHL API Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| **Rate limit**: 100 req/10s per app per resource | Rich push with many contacts could hit it | 200ms inter-company delay + exponential backoff on 429 |
| **Daily limit**: 200K req/day per app per resource | ~10K rich pushes/day — very generous | Monitor usage in logs |
| **No separate Company object** | Companies are contacts with companyName | Use companyName field + CVR custom field for dedup |
| **locationId required everywhere** | Must store and pass on every API call | Stored in `instanceUrl` column, passed to provider |
| **Version header required** | Requests fail without it | Hardcoded in all requests |
| **Custom field IDs are UUIDs** | Must discover/cache after creation | Cached per session (like Pipedrive's hash approach) |
| **Notes are contact-level only** | No org-level notes | Attach to the company contact record |

---

## Implementation Order

1. **Create GHL Marketplace app** and obtain Client ID + Secret (Part A)
2. **Add env vars** — `LEADCONNECTOR_CLIENT_ID` + `LEADCONNECTOR_CLIENT_SECRET` to `.env`
3. **Delete** `lib/crm/providers/salesforce.ts`
4. **Create** `lib/crm/providers/leadconnector.ts` — full CrmClient implementation
5. **Update** `lib/crm/types.ts` — replace salesforce with leadconnector
6. **Update** `lib/crm/index.ts`, `health.ts`, `rich-push.ts`, `token-manager.ts`
7. **Update** OAuth routes (connect + callback) — remove Salesforce special cases, add GHL locationId handling
8. **Update** Settings UI — replace Salesforce card with GHL card
9. **Update** `.env.example`
10. **Test locally** — run through Phases A-G of verification checklist
11. **Deploy to Vercel** — add env vars
12. **Test production** — re-run verification checklist

---

## Critical Files to Create/Modify

1. **CREATE** `lib/crm/providers/leadconnector.ts` — full provider (contacts, notes, custom fields)
2. **DELETE** `lib/crm/providers/salesforce.ts` — replaced by GHL
3. **EDIT** `lib/crm/types.ts` — replace `salesforce` with `leadconnector` in type + config
4. **EDIT** `lib/crm/index.ts` — replace Salesforce client factory with GHL
5. **EDIT** `lib/crm/health.ts` — replace Salesforce health endpoint with GHL
6. **EDIT** `lib/crm/rich-push.ts` — replace salesforce entity mapping
7. **EDIT** `lib/crm/token-manager.ts` — remove Salesforce instance_url special handling
8. **EDIT** `app/api/integrations/[provider]/connect/route.ts` — remove prompt=consent
9. **EDIT** `app/api/integrations/[provider]/callback/route.ts` — extract locationId for GHL
10. **EDIT** `components/settings/crm-integrations-section.tsx` — replace Salesforce card
11. **EDIT** `.env.example` — replace SALESFORCE vars with LEADCONNECTOR vars
