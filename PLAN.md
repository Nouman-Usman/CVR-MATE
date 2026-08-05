# CVR-MATE — Full CRM Pipeline + Built-in Commercial Quotation/Orders

## Context

CVR-MATE is extending from lead-intelligence into a **full CRM pipeline** with a **built-in commercial quotation/order system**. Everything is built **natively in-app** — no external order/accounting/ticketing products, no third-party API dependencies.

**Decisions (hard constraints):**
- **Built-in scope:** Quotation + Orders, built natively (not integrated).
- **Quote depth:** Full commercial — line items, Danish moms (25%), per-line discounts, PDF export, quote→order conversion, accept/reject tracking, per-org numbering.
- **Accounting:** built-in-only philosophy → **no external accounting integration**. Invoicing/billing deferred to a later round; when built it will be in-app, not synced out.
- **Email/calendar:** deferred. Follow-ups ride the **existing tasks/todos** section — no Gmail/Microsoft OAuth, no separate calendar sync.
- **Deferred (future rounds):** invoicing, ticketing, Proff enrichment, a generalized external-integration framework.

**Net effect:** every external blocker is gone (no Google CASA, no product-choice gating). This is a fully-internal, unblocked build — startable day one. The critical path is **money-math correctness**, not third-party lead time.

Foundation already in place (reused, not rebuilt): CVR-keyed `company` cache, encrypted org-scoped `contact` (+ `emailHash` blind index), `companyNote`, `activity` audit log, `todo.dueDate`, a full `deal`/`pipeline` Kanban, `requireCrmOrg` gating, `encryptField`/`blindIndex`, `logActivity`.

---

## Build order (all internal, no blockers)

```
PART A — Full CRM pipeline depth:
  P1 Prospect-by-CVR entry + contact tiering        S
  P2 Own-records search                              M
  P3 Typed interactions + follow-ups                 L   (follow-ups = the "tasks/todos" calendar)
  P4 Contracts + partner segments + reporting        L

PART B — Built-in commercial Quotation + Orders (HEADLINE):
  P5 Product catalog + Quote engine + Order engine   XL  (full commercial: VAT, discounts, PDF, convert)

PART C — Deferred (future rounds, out of scope now):
  - Invoicing / billing            → built-in when built; NO external accounting sync
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
- **Note:** revenue/sales reporting draws from accepted **quotes/orders** (P5), not external accounting. Payment-status stats wait for the deferred invoicing round.

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

## Effort & sequencing

| Phase | Effort | Blocker | Depends on |
|---|---|---|---|
| P1 Prospect-by-CVR | S | none | existing schema |
| P2 Record search | M | none | + `contact.phoneHash`, pg_trgm |
| P3 Interactions + follow-ups | L | none | existing todo/activity |
| P4 Contracts + segments + reporting | L | none | P3 (timeline), P5 (revenue stats) |
| P5 Quotation + Orders | XL | none | existing deal/company; can start after P1 |

All unblocked. Suggested order: **P1 → P5 (start early — headline & largest) → P2 → P3 → P4**, or run P5 in parallel with P2–P4 since it only needs `company`/`deal`/`requireCrmOrg` (all present). The invoicing extension of P5 slots into the next round.

## Verification (per phase, once built)
- **P1:** create a prospect from a real CVR → `companyWorkspace` + `contact` rows + activity; cross-org isolation holds.
- **P2:** exact hits for email/phone/CVR, fuzzy for names; org isolation.
- **P3:** each interaction type + attachment + next-step date → linked todo + `.ics`; timeline renders; delete cascades body + attachments.
- **P4:** varied expiries + segment assignments → expiry buckets + segment rollups; renewal cron emits reminders.
- **P5:** a quote with **mixed-VAT lines + per-line discount** → subtotal/VAT/total correct to the øre; convert → order created + quote `converted`; PDF renders; deal value rolls up; org isolation; plan-limit gate blocks under-tier orgs.

## Critical files (when implemented)
- `db/app-schema.ts` — new tables (`product`, `quote`, `quote_line`, `order`, `order_line`, `document_sequence`, `interaction`, `interaction_attachment`, `contract`, `segment`, `company_segment`) + `contact.phoneHash`, `todo.interactionId`.
- `lib/quotes/totals.ts` (new) — pure øre/VAT/discount engine, the load-bearing unit-tested module.
- `lib/quotes/pdf.tsx` (new) — `@react-pdf/renderer` document template.
- `lib/pii/crypto.ts` — `blindIndex` for `phoneHash`; `encryptField` for interaction bodies.
- `lib/stripe/plans.ts` — new `PlanLimits` flags (`quotations`, `orders`, `productCatalog`).
- `components/company/CrmTab.tsx` — surface quotes/orders/interactions on the profile.

---

_Roadmap only — no implementation yet. On go-ahead, the natural first build is P1 + P5._
