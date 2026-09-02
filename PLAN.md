# CVR-MATE — Full CRM Pipeline + Built-in Commercial Quotation/Orders

## Context

CVR-MATE is extending from lead-intelligence into a **full CRM pipeline** with a **built-in commercial quotation/order system**. The commercial pipeline itself — products, quotes, orders — is built **natively in-app**; no external order or ticketing product sits in the middle of it.

**Invoicing is the deliberate exception.** An invoice is not a document, it is a booked ledger entry that VAT returns are filed from. Denmark's bookkeeping act requires those records to live in a digital bookkeeping system meeting Erhvervsstyrelsen's requirements, and Dinero, e-conomic and Billy are registered systems that already do. CVR-MATE therefore issues no invoices: it hands a fulfilled order to the customer's accounting system and mirrors the result back. See "Accounting" below.

**Decisions (hard constraints):**
- **Built-in scope:** Quotation + Orders, built natively (not integrated).
- **Quote depth:** Full commercial — line items, Danish moms (25%), per-line discounts, PDF export, quote→order conversion, accept/reject tracking, per-org numbering.
- **Accounting:** **integrate, do not become the ledger.** The order stays commercial (what was sold, agreed, fulfilled); the accounting system owns the financial document (invoice number series, booking, VAT, payment). CVR-MATE stores a mirror — external id, invoice number, status, due date, amount, PDF link — and never issues an invoice itself.
  - **Provider order:** e-conomic first (largest Danish SMB base with bookkeepers, most mature REST API), then Dinero, then Billy — one provider-agnostic port, three adapters, mirroring the existing `lib/crm/providers/` pattern.
  - **Draft only.** CVR-MATE creates a *draft* invoice; a human books and sends it in the accounting system. Booking is legally significant and can only be undone with a credit note, so a person stays on that step.
  - **Rejected:** native invoicing (customers would re-record every invoice in their real bookkeeping system, and CVR-MATE would take on standard-system obligations: e-invoicing via NemHandel/Peppol, SAF-T export, 5-year backup). Also rejected: payment-link-first via Stripe/MobilePay — Danish B2B is invoice-on-account, netto 8/14/30, paid by bank transfer.
- **Email/calendar:** deferred. Follow-ups ride the **existing tasks/todos** section — no Gmail/Microsoft OAuth, no separate calendar sync.
- **Deferred (future rounds):** invoicing, ticketing, Proff enrichment, a generalized external-integration framework.

**Net effect:** the headline build is unblocked (no Google CASA, no product-choice gating) and the critical path is **money-math correctness**. The one external dependency is the e-conomic app registration for P6; start that paperwork early so it overlaps P5 instead of following it.

Foundation already in place (reused, not rebuilt): CVR-keyed `company` cache, encrypted org-scoped `contact` (+ `emailHash` blind index), `companyNote`, `activity` audit log, `todo.dueDate`, a full `deal`/`pipeline` Kanban, `requireCrmOrg` gating, `encryptField`/`blindIndex`, `logActivity`.

---

## Build order

P1–P5 are fully internal and startable day one. **P6 is the only externally-gated item**: it needs an e-conomic app registration (app token + agreement-grant flow) before the adapter can be tested against anything real. Sequence it so that lead time runs in parallel with P5 rather than after it.

```
PART A — Full CRM pipeline depth:
  P1 Prospect-by-CVR entry + contact tiering        S
  P2 Own-records search                              M
  P3 Typed interactions + follow-ups                 L   (follow-ups = the "tasks/todos" calendar)
  P4 Contracts + partner segments + reporting        L

PART B — Built-in commercial Quotation + Orders (HEADLINE):
  P5 Product catalog + Quote engine + Order engine   XL  (full commercial: VAT, discounts, PDF, convert)

  P6 Accounting port + e-conomic adapter             L   (order → draft invoice, status mirrored back)

PART C — Deferred (future rounds, out of scope now):
  - Email + calendar deep sync     → deferred; calendar handled via tasks/todos for now
  - Proff enrichment               → deferred
  - Ticketing                      → deferred
  - External integration framework → deferred (existing push-only lib/crm connectors stay as-is)
```

---

## Cross-cutting design rules (decide once, apply in P5)

- **Money in minor units (øre), integers only.** Never float. Every total — line subtotal, discount, VAT, grand total — is computed **server-side**; client-sent values are never trusted.
- **Danish VAT (moms) engine.** Default 25% per line; support 0%/exempt lines; per-line `vatRate` so mixed-rate documents total correctly. Round each line, then sum (Danish convention) — not sum-then-round.
- **Per-org document numbering.** Monotonic sequence via a row-locked `document_sequence(org, docType, nextNumber)` — no gaps, no races. Format e.g. `Q-2026-0001`, `O-2026-0001`.
- **PDF generation serverless-safe.** Use `@react-pdf/renderer` (pure JS — avoids headless Chrome/Puppeteer, which is heavy and fragile on Vercel). Render on demand; optionally cache to a **private** Supabase bucket + signed URL.
- **Pipeline tie-in.** Quotes/orders link to `deal` + `company`; accepted-quote / confirmed-order value can roll into deal value; surface them on the company profile tab and the deal card.
- **Gating.** New `PlanLimits` flags `quotations`, `orders`, `productCatalog` (Professional+/Enterprise). Reuse `requireCrmOrg`, `logActivity`.
- **Follow-ups = calendar.** P3 next-step dates spawn `todo` rows (existing tasks section). That is the calendar surface this round — no two-way sync.

---

## Phases

### P1 — Prospect-by-CVR entry + contact tiering — now · **S**
One-screen "enter CVR → auto-fill → add contacts". No new tables — reuse `company` (lazy upsert), `companyWorkspace` (`status='prospect'`), `savedCompany`, `contact`. `POST /api/prospects` → `resolveCompanyIdByVat` + upsert `companyWorkspace` + optional `savedCompany` + initial `contact[]`. UI reuses `components/company/CrmTab.tsx`.
- **Flag:** `contact.organizationId` is NOT NULL → gate this flow at Professional+/Enterprise (contacts need an org).

### P2 — Own-records search — now · **M**
Search the org's **own** records (name/CVR/email/phone/contact-person) — distinct from the CVR register search. Add `contact.phoneHash` (HMAC blind index + `(org, phoneHash)` index; backfill via E.164 normalize); enable `pg_trgm` + GIN trigram on `company.name`, `contact.name`. `GET /api/records/search?q=` classifies: digits→vat/cvr exact; `@`→`blindIndex(email)`; phone-like→`phoneHash`; else trigram on names. **Limitation:** blind index = exact match only.

### P3 — Typed interactions + follow-ups — now · **L**
Record meeting/visit/call/email/note with topics, materials, next-steps; next-step dates spawn linked follow-up `todo`s (the tasks/calendar surface). Model: `interaction` (org; company/contact/deal refs; `type`, `direction`, `occurredAt`, `subject`, `bodyEnc`, `topics jsonb`, `nextStep`, `source`). `interaction_attachment` (private Supabase bucket + signed URLs) = "materials provided". `todo.interactionId` nullable FK; reuse `.ics` export. Timeline merges `interaction` + `activity`.
- **Scope note:** email `type` is a **manual log** this round (no mailbox auto-ingest — email deferred). Provider/dedup columns are omitted until email returns.

### P4 — Contracts + partner segments + reporting — now · **L**
`contract` (company/deal; status, `startDate`/`expiryDate`, value, `renewalNoticeDays`, `autoRenew`, `externalRef`; indexes on `(org, expiryDate)`/`status`). `segment` + `company_segment` join (normalized reporting axis; keep `companyWorkspace.tags` for freeform). `/api/contracts`, `/api/segments`, `/api/reports/{contract-expiry,segments}`; cron `/api/cron/contract-renewals` (`verifyQStashRequest`) → renewal reminders. Reuse dashboard + `recharts`.
- **Note:** revenue/sales reporting draws from accepted **quotes/orders** (P5). Invoiced and paid amounts arrive with the accounting mirror (P6), so payment-status stats read the mirror rather than a second source of truth.

### P5 — Built-in commercial Quotation + Order engine `(HEADLINE)` — now · **XL**
Native quote→order lifecycle tied to the pipeline. No external product.

**Data model** (all org-scoped, money in øre):
- `product` — optional reusable catalog: `name`, `sku`, `unitPrice`, `vatRate` (default 25), `unit`, `active`. Ad-hoc lines also allowed (no catalog required).
- `quote` — `companyId` (customer), `dealId?`, `quoteNumber` (per-org seq), `status` (draft|sent|accepted|rejected|expired|converted), `currency` (DKK), `issueDate`, `validUntil`, `subtotal`, `discountTotal`, `vatTotal`, `total`, `terms`, `createdBy`, status timestamps (`sentAt`/`acceptedAt`/`rejectedAt`).
- `quote_line` — `quoteId`, `productId?`, `description`, `quantity`, `unitPrice`, `discountPct`, `vatRate`, `lineSubtotal`, `lineVat`, `lineTotal`, `sortOrder`.
- `order` — `companyId`, `dealId?`, `quoteId?` (source), `orderNumber` (per-org seq), `status` (open|confirmed|fulfilled|cancelled), same money fields, `confirmedAt`, `expectedDelivery`.
- `order_line` — mirror of `quote_line`.
- `document_sequence` — `(org, docType, nextNumber)` row-locked counter for quote/order numbers.

**Server logic:**
- Totals engine (pure fn, unit-tested): per line `lineSubtotal = qty*unitPrice*(1-discountPct)`, `lineVat = round(lineSubtotal*vatRate)`, then sum → document totals. Integer øre throughout. Never trust client-sent totals.
- Quote→Order convert: copy quote+lines into order, set `quote.status='converted'`, link `order.quoteId`.
- Accept/reject: status transitions + timestamps (public accept-link deferred; internal mark now).
- Deal rollup: accepted quote / confirmed order value feeds `deal.value`.

**APIs:** `/api/products` (CRUD); `/api/quotes` (GET/POST), `/api/quotes/[id]` (GET/PATCH/DELETE), `/api/quotes/[id]/lines`, `/api/quotes/[id]/send`, `/api/quotes/[id]/convert`, `/api/quotes/[id]/pdf`; `/api/orders` symmetric. All behind `requireCrmOrg` + plan-limit checks + `logActivity`.

**UI:** line-item quote builder with live totals (VAT/discount) on the company profile + deal; orders list/detail; products catalog settings page; PDF download.

---

### P6 — Accounting port + e-conomic adapter — **BUILT** · **L**
Turn a fulfilled order into an invoice the client can pay, **without CVR-MATE becoming the ledger**.

**Principle.** The order is commercial; the accounting system is financial. CVR-MATE never allocates an invoice number, never books, never files VAT. It hands over a draft and mirrors the outcome.

**Flow.** `sales_order` reaches `fulfilled` (or an explicit "Invoice this order") →
resolve the customer in the provider **by CVR** → push order lines as a **draft** invoice →
a human books and sends it there → status flows back to the order and to P4/P5 reporting.

**Data model**
- `accounting_connection` — deliberately a sibling of `crm_connection`, not a reuse of it: a CRM
  connection and a bookkeeping connection have different consequences and should be revocable
  separately. `organizationId` (**NOT NULL** — bookkeeping is an org concern, never personal),
  `provider` (`economic|dinero|billy`), encrypted credentials via `lib/crm/encryption.ts`,
  `isActive`, `connectedAt`. One active connection per org per provider.
- `accounting_customer_map` — `(connectionId, companyId)` → provider customer id. Resolution is
  by CVR first (all three carry a CVR/VAT field), name only as a fallback. This is where
  CVR-MATE is genuinely better than a generic CRM: the customer is created from verified
  registry data. Mirrors `lib/crm/company-resolver.ts`.
- `order_invoice` — the mirror, one row per issued invoice: `orderId`, `connectionId`,
  `externalId`, `invoiceNumber`, `status` (`draft|booked|sent|paid|overdue|credited`),
  `issueDate`, `dueDate`, `total`, `currency`, `pdfUrl`, `lastSyncedAt`.
  **Read-only downstream of the provider** — CVR-MATE writes it only from a sync.

**Port** — `lib/accounting/` mirroring `lib/crm/`:
`types.ts` (`AccountingProvider`, `AccountingClient`), `providers/economic.ts`, `token-manager.ts`,
`customer-resolver.ts`, `sync.ts`. The client interface is small on purpose:
`resolveCustomer(company)`, `createDraftInvoice(order, lines)`, `getInvoice(externalId)`,
`listInvoiceStatuses(since)`.

**Not in P6, deliberately**
- Booking or sending from CVR-MATE (a booked invoice is undone only by a credit note).
- Credit notes, part-payments, dunning — read the status, do not manage the debt.
- Pushing the *ledger* anywhere: no accounts, no postings, no VAT returns.
- EAN/NemHandel/Peppol public-sector invoicing — the provider does this; CVR-MATE must not.

**Status: built, and unverified against a live agreement.**
Schema, port, e-conomic adapter, customer resolver, draft creation, reconciliation, sync, API
routes, cron and order UI are all in place (migrations 0053, 0054). `organization_profile
.default_payment_terms_days` added. The adapter's request shapes follow e-conomic's documented
REST API but **no agreement grant exists yet**, so nothing has touched the real service. Its
transport is injectable and `ECONOMIC_API_BASE_URL` overrides the endpoint, which is how the
end-to-end probe drives the whole flow against a local stand-in.

**Auto-discovery + connect UI: done.** Connecting now takes only the agreement grant token —
`discoverSettings` reads `/customer-groups`, `/vat-zones`, `/payment-terms`, `/layouts` and
`/products` in parallel and pre-selects each. The picking is pure and tested
(`providers/economic-discovery.ts`): the domestic VAT zone is matched by name in both languages
rather than by number, payment terms match the org's netto days and prefer net over prepaid, and a
fallback product is only accepted when it looks deliberately generic — otherwise it stays null,
because invoicing consultancy hours against "Skruer 4mm" would corrupt the customer's reporting.
Every pick carries a `confident` flag, and the Settings form (`components/settings/
accounting-section.tsx`, under the Integrations tab) shows the alternatives with a "guessed" badge
so a person can correct it. `PATCH /api/accounting/connection` saves overrides;
`?rediscover=1` re-reads the agreement.

**Connect flow: no token pasting.** e-conomic does not offer OAuth 2.0 — it has its own grant
flow — so "Connect with e-conomic" sends the user to `requestaccess.aspx` with the app's PUBLIC
token, they approve the app against their agreement, and e-conomic redirects to
`/api/accounting/economic/callback` with the grant token. Because that flow echoes no `state`
parameter, the anti-forgery value rides in a **signed** HttpOnly cookie carrying org + user + a
10-minute expiry (`lib/accounting/grant-state.ts`, pure and tested): a random opaque value would
only prove a browser started a flow, whereas signing proves *which org and user* did, and the
callback still re-asserts `manage_integrations` against the live session. The grant token arrives
as a query parameter, so it is consumed immediately and never echoed, logged, or returned —
verified: it appears zero times in the callback response. Manual token entry is retained behind a
disclosure as a support fallback. Needs `ECONOMIC_APP_PUBLIC_TOKEN`.

**Still outstanding**
- e-conomic app registration (app token + agreement grant) — the only external lead time.
  Recommended roles: **Accounting** only. Not Superuser (full books access for a draft-creating
  integration), not Sales (that is e-conomic's quote/order module — CVR-MATE *is* that module, and
  requiring it would exclude customers who lack it). No required modules. Roles cannot be changed
  after creation, so confirm with e-conomic support that `Accounting` covers `POST /customers` and
  `POST /invoices/drafts` before submitting.
- Dinero and Billy adapters — the schema and port already accept them.
- Registering the QStash schedule for `/api/cron/accounting-sync`.

**Verification**
- Order with **mixed-VAT lines and per-line discounts** → draft invoice in e-conomic whose totals
  match the order to the øre.
- Customer resolution: unknown CVR → customer created with registry data; known CVR → reused, not
  duplicated; two orders for the same company produce one customer.
- Book the draft in e-conomic → sync flips `order_invoice.status` and surfaces the real invoice
  number; mark it paid → order shows Paid.
- Disconnecting the provider leaves `order_invoice` rows intact and readable (history is not
  contingent on a live connection).
- Org isolation: an order in org A can never resolve a customer or invoice through org B's
  connection.

## Effort & sequencing

| Phase | Effort | Blocker | Depends on |
|---|---|---|---|
| P1 Prospect-by-CVR | S | none | existing schema |
| P2 Record search | M | none | + `contact.phoneHash`, pg_trgm |
| P3 Interactions + follow-ups | L | none | existing todo/activity |
| P4 Contracts + segments + reporting | L | none | P3 (timeline), P5 (revenue stats) |
| P5 Quotation + Orders | XL | none | existing deal/company; can start after P1 |

Suggested order: **P1 → P5 (start early — headline & largest) → P2 → P3 → P4 → P6**, or run P5 in parallel with P2–P4 since it only needs `company`/`deal`/`requireCrmOrg` (all present). P6 depends on P5's order engine; begin the e-conomic app registration during P5 so the approval lead time is spent, not waited on.

## Verification (per phase, once built)
- **P1:** create a prospect from a real CVR → `companyWorkspace` + `contact` rows + activity; cross-org isolation holds.
- **P2:** exact hits for email/phone/CVR, fuzzy for names; org isolation.
- **P3:** each interaction type + attachment + next-step date → linked todo + `.ics`; timeline renders; delete cascades body + attachments.
- **P4:** varied expiries + segment assignments → expiry buckets + segment rollups; renewal cron emits reminders.
- **P6:** see the phase's own verification block above — totals match to the øre, customers resolve by CVR without duplicating, and booking in e-conomic flows back to the order.
- **P5:** a quote with **mixed-VAT lines + per-line discount** → subtotal/VAT/total correct to the øre; convert → order created + quote `converted`; PDF renders; deal value rolls up; org isolation; plan-limit gate blocks under-tier orgs.

## Critical files (when implemented)
- `db/app-schema.ts` — new tables (`product`, `quote`, `quote_line`, `order`, `order_line`, `document_sequence`, `interaction`, `interaction_attachment`, `contract`, `segment`, `company_segment`) + `contact.phoneHash`, `todo.interactionId`.
- `lib/quotes/totals.ts` (new) — pure øre/VAT/discount engine, the load-bearing unit-tested module.
- `lib/quotes/pdf.tsx` (new) — `@react-pdf/renderer` document template.
- `lib/pii/crypto.ts` — `blindIndex` for `phoneHash`; `encryptField` for interaction bodies.
- `lib/stripe/plans.ts` — new `PlanLimits` flags (`quotations`, `orders`, `productCatalog`).
- `components/company/CrmTab.tsx` — surface quotes/orders/interactions on the profile.
- `lib/accounting/` (new) — provider-agnostic port + e-conomic adapter (P6), shaped after `lib/crm/`.
- `db/app-schema.ts` — P6 adds `accounting_connection`, `accounting_customer_map`, `order_invoice`.

---

_P5's quote/order engine is built; P6 is specified and not yet implemented._
