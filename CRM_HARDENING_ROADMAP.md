# CVR-MATE — CRM Hardening & Completion Roadmap

> **Status:** planning document. No code in this round.
> **Scope:** remediation + completion of the CRM/quotation build delivered in `PLAN.md` phases P1–P5 (branch `feat-search`).
> **Source:** four-agent code audit (API/security, schema/migrations, UX/i18n, hooks/libs), 2026-08-06. ~91 findings.
> **Audit verdict:** 5/10 overall. Tenant isolation and the money engine are strong; concurrency, authorization consistency, UX conventions, and customer-facing quote delivery are not production-ready.

---

## How to read this document

Phases are ordered by **dependency and risk**, not by size. Each phase carries:

- **Objective** — what "done" changes about the product.
- **Why this position** — what breaks if it is sequenced later.
- **Dependencies** — hard prerequisites.
- **Feature groups** — the unit of work handed to a developer. Each has purpose, technical approach, backend changes, frontend changes, acceptance criteria.
- **Risks & mitigations.**
- **Effort** — dev-days for one senior full-stack engineer already familiar with this codebase. Multiply by ~1.4 for someone new.
- **Exit criteria** — the gate that must pass before the next phase starts.

Findings are referenced by code: `API-n`, `DB-n`, `UX-n`, `LIB-n`. Full traceability matrix at the end — every audit finding maps to exactly one phase.

**Release trains:** Phases 0–3 are one train (internal-usable CRM). Phase 4 is the train that makes the product claim true. Phases 5–10 are hardening and scale.

---

## Phase overview

| Phase | Theme | Effort | Ship gate |
|---|---|---|---|
| **0** | Unblock & baseline | 0.5d | ✅ **done** — schema verified, ledger SQL pending manual run |
| **1** | Correctness & authorization (P0) | 3d | ✅ **code done + verified** — migration 0035 pending apply |
| **2** | Shared client primitives | 4d | ✅ **done + verified** — CrmTab conversion deferred to Phase 8 |
| **3** | Quote authoring completeness | 4d | ✅ **done + verified** — interactions type/date filter deferred |
| **4** | Close the customer loop | 6d | ✅ **done + verified** — snapshot-in-DB instead of PDF-in-bucket (see FG-4.1 note) |
| **5** | Money unification | 2d | ✅ **done + verified** — migration 0036 applied, conversion proved exact |
| **6** | Lifecycle & background jobs | 3d | ✅ **code done + verified** — QStash schedules await manual registration |
| **7** | Scale, performance, security | 4d | ✅ **done + verified** — migration 0038, 0 unindexed FKs, rate limits fail closed in prod |
| **8** | Information architecture | 5d | ✅ **done + verified** — CrmTab 1098→28 lines; nav regrouped (item count still 19, see note) |
| **9** | Accessibility & visual polish | 2d | ✅ **done + verified in-browser** — combobox keyboard path, `.row-action`, 0 unnamed CRM controls |
| **10** | Test harness & CI gates | 4d | ✅ **done, with one scope decision** — `pnpm lint` exits 0 and CI blocks on tsc+lint; tests stay local (see note) |
| **11** | CRM parity backlog | — | 4 of 8 shipped — omnisearch, audit UI, attachments, CSV import |

**Total to end of Phase 10: ~37.5 dev-days (~7.5 calendar weeks solo, ~4.5 weeks with two engineers).**

### Dependency graph

```
P0 ──> P1 ──> P2 ──┬──> P3 ──> P4 ──> P6
                   │           ▲
                   ├──> P5 ────┘
                   ├──> P7
                   ├──> P8 ──> P9
                   └──> P10 (starts with P1, runs continuously)
```

- P1 must precede everything: it fixes paths that corrupt data.
- P2 is a **force multiplier** — every later phase touching UI is ~30% cheaper after it. Do not skip it to "get to features".
- P5 (money unification) must land **before** P4 stores immutable PDF snapshots, or snapshots are taken in the wrong unit.
- P10 begins in parallel with P1 (write the regression test for each P0 fix as it lands).

---

# Phase 0 — Unblock & baseline

**Objective:** put the shipped code into a state where it actually runs, and close the one live security exposure.

**Why this position:** every finding below is theoretical until migrations are applied. Nothing can be verified before this.

**Dependencies:** none.

**Effort: 0.5 day.**

### FG-0.1 — Apply pending migrations

- **Purpose:** migrations `0030`→`0034` are unapplied; all CRM features 500 on a fresh database.
- **Technical approach:** apply in strict order on a staging clone first, capture timings, then production. `0034` is 33 statements with no `IF NOT EXISTS` (DB-14) — a partial failure cannot be re-run without manual cleanup, so wrap the production run in a documented rollback (restore-from-snapshot, not down-migration).
- **Backend:** `pnpm db:migrate`. Review `0031`'s `CREATE INDEX` on `contact` — non-concurrent, write-locks the table (trivial at current size, note it for future).
- **Frontend:** none.
- **Acceptance:** all 5 migrations applied; `/quotes`, `/orders`, `/products`, `/reports`, `/interactions`, `/records` return 200 for an Enterprise org; drizzle journal matches the filesystem.

### FG-0.2 — Rotate exposed CRON_SECRET

- **Purpose:** the value was pasted into a chat transcript. Treat as compromised.
- **Technical approach:** rotate in the hosting provider's env store and in QStash's configured headers simultaneously; verify both cron endpoints reject the old value.
- **Acceptance:** old secret returns 401 on `/api/cron/triggers` and `/api/cron/contract-renewals`; scheduled runs still succeed.

### FG-0.3 — Baseline capture

- **Purpose:** know what "no regression" means before changing anything.
- **Technical approach:** record `pnpm exec tsc --noEmit`, `pnpm lint` (note the pre-existing `dashboard-layout.tsx` `Date.now()`-in-render error and Tailwind warnings as known-baseline), `pnpm test:run` output. Snapshot production row counts per new table.
- **Acceptance:** a `BASELINE.md` note or CI artifact recording current failures, so later phases can prove they only reduced the count.

**Risks:** migration `0034` partially applying on production. **Mitigation:** staging rehearsal + snapshot immediately before.

**Exit criteria:** features reachable, secret rotated, baseline recorded.

---

# Phase 1 — Correctness & authorization (P0)

**Objective:** eliminate every known path that silently corrupts money, duplicates documents, or lets the wrong user change commercial state.

**Why this position:** these are the only findings that damage data that cannot be recovered by a later release. Everything else is inconvenience.

**Dependencies:** Phase 0.

**Effort: 3 days.**

### FG-1.1 — Conditional-write concurrency pattern *(API-1, API-2, API-19, API-25, DB-8c)*

- **Purpose:** kill the double-convert race (two concurrent converts produce two sales orders from one quote, one orphaned with a burnt O-number) and check-then-act status transitions (a quote can end `rejected` with `acceptedAt` set and the deal rollup already fired).
- **Technical approach:** establish **one standing idiom** — *conditional UPDATE with `RETURNING`, row count as the guard* — and apply it to all four sites. The codebase already contains the correct shape in `lib/quotes/numbering.ts` (single-statement `INSERT..ON CONFLICT..RETURNING`); this generalizes it. Reject the alternative of `SELECT ... FOR UPDATE` + application check: more round-trips, same guarantee, easier to get wrong.
- **Backend:**
  - `app/api/quotes/[id]/convert/route.ts` — inside the transaction, `UPDATE quote SET status='converted', converted_order_id=$o WHERE id=$id AND status='accepted' AND converted_order_id IS NULL RETURNING id`; 0 rows ⇒ rollback + `409 Conflict`.
  - `app/api/quotes/[id]/status/route.ts` — `WHERE id=$id AND status=$expectedFrom`; 0 rows ⇒ `409`.
  - Move `nextDocumentNumber()` **inside** the transaction in both `quotes/route.ts` and `convert/route.ts` so failed inserts stop burning sequence numbers (API-19).
  - `lib/crm/interactions.ts` `syncFollowUpTodo` — add partial unique index on `todo(interaction_id) WHERE deleted_at IS NULL`, convert find-then-insert to upsert (API-25). Requires a new migration.
- **Frontend:** mutation hooks surface `409` as a human message ("This quote was already converted — refreshing") and refetch rather than showing a raw error.
- **Acceptance:**
  - A test firing 10 concurrent converts against one accepted quote produces **exactly one** `sales_order` and nine `409`s.
  - Concurrent accept+reject leaves exactly one terminal status with only its own timestamp set.
  - A forced insert failure after number allocation leaves **no gap** in the Q-/O- sequence.

### FG-1.2 — Danish money & quantity input *(LIB-1, LIB-2, LIB-9, API-3)*

- **Purpose:** the quote builder currently turns `1.234,56` into **1,23 kr** (`parseFloat` on `"1.234.56"`) and `2,5` into `0`. This is the money-entry point of a Danish quoting tool mangling Danish number format — the single most damaging bug found.
- **Technical approach:** one shared locale-aware parser in `lib/format.ts` (or new `lib/money/parse.ts`) used by every numeric money/quantity input. Rule: strip whitespace and NBSP, treat the **last** `.` or `,` as the decimal separator, strip all earlier separators, reject if the result is not finite or has >2 decimals for money. **Return `null` on unparseable input — never `0`.** A silent zero is worse than an error because it produces a valid-looking free line item.
- **Backend:** `lib/validation/crm.ts` — `quantity` becomes `.gt(0)` (currently `.min(0)`, which *accepts* the zero the client produces); add a per-line overflow refine (`quantity * unitPrice` capped at a sane org limit, e.g. 1e13 øre) because qty ≤1e9 × price ≤1e15 individually pass validation but their product exceeds `MAX_SAFE_INTEGER` and corrupts silently before Postgres bigint even complains (API-3). Add a max line count per document.
- **Frontend:** `app/quotes/new/page.tsx` + `app/products/page.tsx` — replace `dkkToOre`/`Number(x)||0` with the shared parser; invalid input blocks submit with inline field errors; `computeLine`'s clamps must match the schema exactly (currently the preview clamps discount to 100 and lets `vatRate` exceed 100, so the UI renders a total the server then rejects — LIB-9).
- **Acceptance:**
  - Table-driven test: `1.234,56` / `1 234,56` / `1234.56` / `1,234.56` all → `123456` øre; `abc`, `1,2,3`, `` → `null`.
  - Entering `2,5` as quantity produces a 2.5-unit line, not a 0-total line.
  - Submitting a line whose product overflows returns `400` with a field-level message, not a 500.
  - Client preview total and server-persisted total are byte-identical for 50 randomized valid inputs (property test).

### FG-1.3 — Authorization parity *(API-4)*

- **Purpose:** quotes `PATCH`/`DELETE`, contracts, segments and interactions enforce `assertCanMutateResource` (creator-or-admin), but **status change, convert, order PATCH, and product PATCH/DELETE skip it**. A plain member who cannot edit a draft can accept it — firing the deal rollup — and can delete any product in the catalog.
- **Technical approach:** audit-and-apply, not redesign. Add the existing assertion to the four routes. Then add a lint-level guard: a short checklist in `AGENTS.md` plus a test that enumerates mutation routes and asserts each calls the helper (cheap reflection over the route files, or an explicit registry).
- **Backend:** four route files. Decide explicitly whether product mutations are org-admin-only (recommended — a shared catalog is org property, not creator property) rather than creator-or-admin.
- **Frontend:** hide/disable the affected actions for users who will be rejected, so the API check is a backstop rather than the first signal.
- **Acceptance:** a member-role user receives `403` on send/accept/reject/convert of another user's quote, on order PATCH, and on product PATCH/DELETE; an admin receives `200`.

### FG-1.4 — Deal rollup integrity *(API-5, API-6, DB-2c, LIB-3)*

- **Purpose:** accepting a quote writes into `deal.amount` in four broken ways at once: outside the transaction (accept can commit with the rollup lost), as **fractional kroner** into a whole-DKK column, with **no soft-delete guard** (writes into deleted deals), and the client never invalidates the board so the Kanban shows a stale number regardless.
- **Technical approach:** single transaction wrapping status change + rollup; `Math.round(total / 100)`; `AND deal.deleted_at IS NULL` in the update predicate; return `dealId`/`pipelineId` in the mutation response so the hook can invalidate precisely.
- **Backend:** `app/api/quotes/[id]/status/route.ts`.
- **Frontend:** `lib/hooks/use-quotes.ts` — `useQuoteStatus.onSuccess` invalidates `["deal", dealId]` and the `["board"]` prefix. (Full invalidation-map repair is Phase 2; this specific one is P0 because it presents wrong money.)
- **Acceptance:** accepting a quote from the board updates the visible deal amount without a manual refresh; the stored `deal.amount` has no decimal component; accepting a quote linked to a soft-deleted deal changes no rows and does not error.

### FG-1.5 — Company cascade containment *(DB-1)*

- **Purpose:** `company` is the **shared, org-agnostic CVR cache**, yet `quote`, `sales_order`, `contract`, `interaction`, and `contact` all cascade-delete from it. The first cache-cleanup or dedupe script ever run against `company` silently destroys every organization's commercial documents — records with Danish bookkeeping-retention implications — with no audit trail. No code deletes company rows today: the bomb is armed but unlit.
- **Technical approach:** migration changing the company FK on `quote`, `sales_order`, and `contract` to `ON DELETE RESTRICT`. Keep `CASCADE` for cheap derived rows (`interaction`, `contact`, `company_segment`) where regeneration is possible — but document the choice in the schema. Add a comment block at the `company` table declaring it a shared cache that must never be hard-deleted.
- **Backend:** one migration; no route changes.
- **Acceptance:** `DELETE FROM company WHERE id=$x` with a dependent quote raises a foreign-key violation instead of succeeding.

**Risks:**
- *Conditional writes change error surfaces* — routes that previously always succeeded now return `409`. **Mitigation:** FG-1.1 frontend work is not optional; ship together.
- *Money-parser change alters existing draft behavior.* **Mitigation:** it only affects new input; existing persisted øre values are untouched.

**Exit criteria:** all five feature groups have regression tests (Phase 10 starts here); no known path corrupts data; `tsc` + lint at or below baseline.

---

# Phase 2 — Shared client primitives

**Objective:** stop the bleeding on consistency. Build the five missing primitives once, then convert all ten new pages.

**Why this position:** the audit's most repeated finding is that **zero of ten new pages match the app's own house style**. Every subsequent phase adds UI; doing it before those phases makes them cheaper and prevents adding an eleventh variant.

**Dependencies:** Phase 1 (avoid editing the same route files simultaneously).

**Effort: 4 days.**

### FG-2.1 — `fetchJson` + hook factory *(LIB-14, LIB-15, LIB-19, LIB-20)*

- **Purpose:** the fetch→parse→error-extract wrapper is copy-pasted **40 times** across `lib/hooks`, each with untyped `data.error` access and inconsistent non-JSON handling.
- **Technical approach:** one `lib/api/fetch-json.ts` returning a typed result and throwing a structured `ApiError` (status + code + message) — the structured status is what lets FG-1.1's `409` handling and Phase 9's i18n error translation work at all. Then a thin `createCrudHooks` factory for the repetitive list/create/update/delete triads. Do not over-abstract: pages with bespoke query shapes keep hand-written hooks.
- **Backend:** none.
- **Frontend:** all CRM hooks migrate; response DTOs derived from server types instead of hand-duplicated (`SerializedInteraction` vs `Interaction` currently drift by hand); `records-search` query key uses the trimmed value so `"foo"` and `"foo "` share a cache entry.
- **Acceptance:** the string `res.json().catch(() => ({}))` appears **once** in `lib/`; every hook error carries an HTTP status; ~200 lines deleted; `tsc` clean.

### FG-2.2 — Query-state components: Skeleton / QueryError / EmptyState *(UX-4, UX-12, UX-13)*

- **Purpose:** three loading systems across ten pages, and **error states that lie** — the reports page renders "Ingen kontrakter at vise" when the query *failed*; quotes/orders/products don't even destructure `error`; quote and order detail pages render "Indlæser…" **forever** on a 404.
- **Technical approach:** three small components mirroring the house baseline already present in `app/saved/page.tsx` (Skeleton rows, error Card with a Retry button wired to `refetch`, empty state with a primary CTA). Establish the rule: **every `useQuery` consumer must handle `isLoading` / `isError` / empty explicitly** — a page that renders data without an `isError` branch fails review.
- **Frontend:** all ten new pages plus the six sections inside `CrmTab`. Detail pages branch on `isError || (!isLoading && !data)` → not-found card with a back link.
- **Acceptance:** every new page shows a skeleton matching its final layout, a retryable error card on failure, and a CTA-bearing empty state; a 404 quote id shows "not found", not a spinner; no page renders an empty state on error.

### FG-2.3 — ConfirmDialog for destructive actions *(UX-1, UX-2, UX-3)*

- **Purpose:** quote, product, segment, interaction and contract deletes are **one click, permanent, no confirmation**, in four mutually inconsistent styles (native `window.confirm`, one-click + toast, one-click silent). Contract delete has **no error handler at all** — failure is invisible.
- **Technical approach:** one `ConfirmDialog` wrapper over the existing shadcn AlertDialog, taking entity name and consequence text. Naming the specific object ("Delete quote Q-00042 for Novo Nordisk?") is the difference between a speed bump and an actual guard.
- **Frontend:** every delete site; all mutations get `onError` toasts.
- **Acceptance:** no destructive mutation fires without confirmation; a forced failure surfaces a visible error on every delete path; `window.confirm` appears nowhere in `components/` or `app/`.

### FG-2.4 — StatusBadge + Danish status labels *(UX-5, UX-10, UX-19)*

- **Purpose:** a Danish-first product renders raw English enum values (`draft`, `sent`, `fulfilled`, `churned`) in every status pill on six surfaces. Worse, two style maps are **exported from `page.tsx` route modules and imported via `../page`** — unsupported App Router surface that couples detail pages to list-page modules.
- **Technical approach:** `components/crm/StatusBadge.tsx` + a status vocabulary in `lib/crm/status.ts` (style + da/en label per status per document type). The interactions page already does this correctly with `typeLabel` — generalize that.
- **Frontend:** six pill sites; delete the four copy-pasted maps and the cross-page imports; raw ISO `nextStepAt` dates run through `formatDate`.
- **Acceptance:** no page module exports a non-route symbol; every status renders a translated label; one style map exists.

### FG-2.5 — i18n consolidation *(UX-26, UX-27)*

- **Purpose:** eleven files each re-declare a private inline `tr(da, en)` while the house pattern is the typed dictionary (`t.saved`, `t.todos`). Strings are untracked and duplicated. Separately, **every hook throws English error text** that surfaces raw in Danish users' toasts.
- **Technical approach:** two decisions to make explicitly. (1) Promote `tr` into `lib/i18n` as a sanctioned helper *or* migrate strings into the dictionary — recommend the dictionary for anything user-facing and reusable, `tr` only for one-off inline copy. (2) Errors carry **codes** from the API (enabled by FG-2.1); translation happens at the display site, never at the throw site.
- **Frontend:** the eleven files; a shared `useApiErrorMessage(error)` that maps code → localized string with a generic fallback.
- **Acceptance:** no user-visible English string in a Danish session on any CRM page, including error toasts and empty states; `grep` finds one `tr` definition.

### FG-2.6 — Invalidation map repair *(LIB-5, LIB-6, LIB-7, LIB-23a)*

- **Purpose:** cache holes make the app show stale truth: creating an interaction never invalidates the global feed; quote mutations never invalidate `company-activity` although every quote route writes an activity row; contract mutations don't invalidate the segments report; meanwhile every quote mutation over-invalidates `["orders"]` even when orders cannot have changed.
- **Technical approach:** a single `lib/hooks/query-keys.ts` declaring the key namespace, plus a written map of mutation → affected keys reviewed as a unit. Mutations return the identifiers needed to invalidate precisely (`companyVat`, `dealId`).
- **Backend:** mutation responses include `companyVat` where the client needs it.
- **Frontend:** all CRM mutation hooks.
- **Acceptance:** a documented mutation→keys table in the repo; manual script: log an interaction, open the feed — it is there; create a contract, open reports — value updated; no mutation invalidates a key it cannot affect.

**Risks:** large diff surface touching every CRM page at once. **Mitigation:** convert page-by-page behind the same PR series; each page is independently reviewable; no behavioral change beyond the intended states.

**Exit criteria:** one pattern per concern; a new CRM page can be written by copying an existing one without importing a bad habit.

---

# Phase 3 — Quote authoring completeness

**Objective:** make the quote builder a tool a salesperson can actually use twice.

**Why this position:** it depends on Phase 2's primitives and must precede Phase 4 — sending a customer a quote you cannot edit is worse than not sending it.

**Dependencies:** Phase 2 (forms, errors, confirms), Phase 1 (parsing).

**Effort: 4 days.**

### FG-3.1 — Draft edit & duplicate *(UX-8)*

- **Purpose:** `PATCH /api/quotes/[id]` exists and supports wholesale line replacement, but **no Edit button and no edit page exist**. A typo in a 12-line quote requires deleting and retyping the whole document. There is no duplicate action either, so recurring quotes are retyped from scratch.
- **Technical approach:** extract the builder from `app/quotes/new/page.tsx` into a shared `QuoteBuilder` component parameterized by mode (create | edit), then add `/quotes/[id]/edit`. Duplicate is a server action that copies header + lines into a new draft with a fresh number (never reusing a burnt number).
- **Backend:** `POST /api/quotes/[id]/duplicate`; edit route enforces draft-only (already true in PATCH) and returns `409` for non-draft.
- **Frontend:** Edit button on draft quotes only; Duplicate on any status; builder prefilled; line reordering preserved.
- **Acceptance:** editing a draft changes totals correctly and leaves the quote number unchanged; editing a `sent` quote is impossible from the UI and rejected by the API; duplicating an accepted quote yields an independent draft with a new number.

### FG-3.2 — Draft safety: autosave & unsaved-changes guard *(UX-7)*

- **Purpose:** a user can build a twelve-line quote and lose it entirely — Cancel and browser-back discard silently, with no warning and no recovery. Same for a filled prospect contact list.
- **Technical approach:** two layers. (1) `beforeunload` + a router-navigation guard when the form is dirty — cheap, covers accidental exit. (2) Local draft persistence keyed by a client-generated draft id, restored on return with an explicit "Restore draft?" prompt. Prefer localStorage over server drafts: no schema change, no orphan-draft cleanup job, and the data is low-value until submitted.
- **Frontend:** `QuoteBuilder`, `app/prospects/new/page.tsx`.
- **Acceptance:** navigating away from a dirty builder prompts; reloading offers restore; submitting or explicitly discarding clears the stored draft.

### FG-3.3 — Inline validation *(UX-14, API-11, LIB-12)*

- **Purpose:** validation is toast-on-submit only. Required fields are marked with an asterisk **inside a placeholder** that disappears on typing; the quote builder marks nothing required. On the server, `z.coerce` on money fields means `null`→0, `true`→1, `[]`→0 all **pass validation as prices**, and the date regex accepts `2026-13-99` → 500 on the Postgres parse.
- **Technical approach:** field-level errors rendered next to inputs (react-hook-form or a minimal local error map — match whatever `app/todos` already does). Server: replace `z.coerce.number()` with `z.number().int()` on JSON bodies (bodies are JSON; numbers are already numbers), real calendar-date validation, and cross-field refinements (`validUntil >= issueDate`, `expiryDate >= startDate`) that currently do not exist anywhere.
- **Backend:** `lib/validation/crm.ts`; unify the three different CVR validations (LIB-11) into one shared schema.
- **Acceptance:** invalid date `2026-13-99` returns `400` with a field message, not `500`; a JSON body with `"unitPrice": null` is rejected; every required field is visibly marked and blocks submit inline.

### FG-3.4 — List ergonomics *(UX-18, API-12, API-21)*

- **Purpose:** quotes, orders, and products lists have no search, filter, sort, or pagination — and `useQuotes(status?)` / `useOrders(status?)` **already accept a status parameter no UI ever passes**. Built, never wired. Server-side, quotes/orders hard-cap at 100 rows with no cursor, so quote #101 is unreachable by any means.
- **Technical approach:** cursor pagination on quotes/orders using the existing `parsePagination` helper (already used correctly by interactions and contracts); status filter chips on the client (free — the hooks take the param); text filter on products; type/date filter on the interactions feed. Validate the `status` query param against the enum so garbage returns `400` rather than an empty list.
- **Backend:** `app/api/quotes/route.ts`, `app/api/orders/route.ts`.
- **Frontend:** filter chips, a total count, load-more.
- **Acceptance:** an org with 250 quotes can reach all of them; filtering by `accepted` issues one request and returns only accepted; an invalid status returns `400`.

**Risks:** builder extraction is the largest refactor in this phase. **Mitigation:** do it first, with the create path unchanged in behavior, before adding edit mode.

**Exit criteria:** a salesperson can create, correct, duplicate, and find a quote without losing work.

---

# Phase 4 — Close the customer loop *(the phase that makes P5's claim true)*

**Objective:** a customer receives a quote document and can accept or reject it. Today "Send" is a button that changes a database column — no email, no delivery, no customer-visible artifact.

**Why this position:** it is the largest single gap between the product claim ("built-in commercial quotation system") and the product. It depends on Phase 3 (a quote you can fix) and Phase 5 (a stable money unit) for the immutable snapshot to be correct.

**Dependencies:** Phase 3; **Phase 5 should land first** (see risk note). New infrastructure: private object storage.

**Effort: 6 days.** This is the phase most likely to expand — treat the public accept page as a hard scope boundary.

### FG-4.1 — Private storage bucket (shared enabler)

- **Purpose:** currently Supabase storage is admin-only and single-bucket. Two deferred features need the same missing thing: stored quote PDFs (this phase) and interaction attachments ("materials provided", deferred in P3).
- **Technical approach:** one private bucket with user-scoped upload authorization and short-lived signed URLs for reads. Deletion must cascade with the owning record for GDPR. Build it once, generically, so attachments can reuse it later without a second design.
- **Backend:** storage helper module, upload/sign/delete functions, org-scoped path convention (`{orgId}/quotes/{quoteId}/{version}.pdf`).
- **Acceptance:** a signed URL expires; a user from another org cannot read a path even with the object key; deleting a quote removes its objects.

### FG-4.2 — Server-rendered PDF with seller identity *(LIB-4, LIB-13, LIB-23b)*

- **Purpose:** the current PDF is generated **client-side with jspdf** and prints the *customer's* name and CVR but **not the seller's** — no issuing company, no seller CVR, no address, no payment terms. A commercial Danish tilbud needs those. `userBrand` data already exists in the database and is unused. Totals and the 10,000-character terms field are drawn with **no page-break check** and silently render off the bottom of the last page.
- **Technical approach:** move rendering server-side. `@react-pdf/renderer` (the original plan) is serverless-safe and paginates declaratively — prefer it over keeping jspdf, whose manual `finalY` cursor math is exactly what causes the overflow bug. Render on status transition and **store the artifact**: the customer must be able to see the same document later, and a quote's legal meaning is the version that was sent, not a re-render of current data.
- **Backend:** `lib/quotes/pdf-document.tsx` (React PDF template), render-on-send, store to FG-4.1, record the storage key + version on the quote. Seller block from `userBrand`/organization. Dates via `formatDate`, brand color from `userBrand` rather than the hardcoded blue.
- **Frontend:** download fetches the stored artifact rather than re-rendering; drafts render on demand (unstored preview).
- **Acceptance:** a sent quote's PDF contains seller name, CVR, address, payment terms, and customer details; a 60-line quote with 10,000-character terms paginates with nothing clipped; re-downloading a sent quote after editing the product catalog returns the **original** document.

### FG-4.3 — Quote delivery by email

- **Purpose:** make "Send" mean sent.
- **Technical approach:** reuse the existing multi-provider dispatch (`lib/email`, Resend primary). The audit found `dispatchNotificationEmail` accepts only three template IDs and has no generic transactional path — that limitation also blocked P4's renewal emails, so build the generic sender here and let Phase 6 reuse it. Attach the PDF or link to a signed URL (recommend link + short expiry; attachments hurt deliverability and leak the document into mail archives).
- **Backend:** new React Email template (da/en); generic transactional send; log to `emailLog`; record `sentAt`, recipient, and template version on the quote.
- **Frontend:** send dialog — recipient (prefilled from the company's primary contact), subject, optional message, preview.
- **Acceptance:** sending delivers an email with a working link; failure to send does **not** advance the quote status; the send is recorded in `emailLog` and on the company activity timeline.

### FG-4.4 — Public accept/reject page

- **Purpose:** let the customer act without an account. This is what converts a quoting tool from internal bookkeeping into a sales instrument.
- **Technical approach:** tokenized public route `/q/[token]`. Design constraints that matter: high-entropy single-purpose token (not the quote UUID); server-side expiry tied to `validUntil`; the page is **excluded from middleware auth** and must therefore be rate-limited independently and leak no org data beyond the document itself; acceptance recorded with IP and timestamp for evidentiary value; token invalidated on terminal status.
- **Backend:** token column + index, public GET (document view) and POST (accept/reject) routes outside `requireCrmOrg`, rate limited; reuse FG-1.1's conditional-write pattern so a customer double-click cannot double-accept.
- **Frontend:** unauthenticated, mobile-first document view with Accept/Reject, confirmation state, and a localized thank-you. No app chrome, no navigation into the product.
- **Acceptance:** an anonymous browser with the link can view and accept; the same link after expiry shows an expired notice; acceptance fires the deal rollup and an in-app notification to the owner; the token cannot be used to enumerate other quotes; a bot hammering the endpoint is rate-limited.

**Risks:**
- *Unit change after snapshots exist* — if Phase 5 lands after this, stored PDFs and the live database disagree. **Mitigation:** sequence Phase 5 first, or accept the migration must re-render nothing (snapshots are immutable by design, so a mixed-unit history is permanent). **Recommendation: do Phase 5 first.**
- *Public route is new attack surface.* **Mitigation:** independent rate limiting, token entropy review, no org identifiers in the response body, explicit security review before merge.
- *Scope creep into e-signature, payment links, customer portals.* **Mitigation:** explicitly out of scope this phase.

**Exit criteria:** a quote created in the app arrives in a customer's inbox and can be accepted by them, with the accepted document permanently retrievable.

---

# Phase 5 — Money unification

**Objective:** one money unit in the database.

**Why this position:** small, mechanical, and cheapest now while the tables are nearly empty. Must precede Phase 4's immutable snapshots.

**Dependencies:** Phase 1 (rollup already rounds correctly).

**Effort: 2 days.**

### FG-5.1 — Øre everywhere *(DB-3, LIB-8)*

- **Purpose:** three conventions coexist — `contract.value` in whole DKK, `quote`/`sales_order` in øre, `deal.amount` whole-DKK-by-convention but accepting fractions. The first cross-domain report (contract value vs order revenue — an obvious CRM report) will be **100× wrong on one side**, and `formatDKK` vs `formatOre` can already render the same accepted quote one krone apart on the deal card versus the quote page.
- **Technical approach:** migrate `contract.value` and `deal.amount` to integer øre; retire `formatDKK` for CRM money in favor of `formatOre`. Data migration multiplies existing values by 100 — verify row counts and spot-check before/after. Separately fix the IEEE754 half-øre misrounding in `totals.ts` (`0.35 * 10 = 3.4999…` rounds to 3 where decimal math gives 4) with epsilon-aware rounding or integer milli-unit quantities.
- **Backend:** migration + every read/write site of the two columns; validation schemas.
- **Frontend:** every display site; input parsers from FG-1.2 already emit øre.
- **Acceptance:** one money unit documented in `AGENTS.md`; a contract worth 1.234,56 kr and an order worth 1.234,56 kr render identically; the half-øre test case rounds per decimal expectation; no `formatDKK` call remains on CRM money.

### FG-5.2 — Currency: honest or real *(DB-12)*

- **Purpose:** `quote`/`sales_order` carry a `currency` column defaulting to DKK that **no schema exposes and no formatter honors** — both formatters hardcode DKK. `contract`/`deal` accept any 3 characters (`"abc"` passes). Shipping the shape of multi-currency without the behavior is worse than omitting it.
- **Technical approach:** decide. Recommend **honesty now**: `z.literal("DKK")`, drop or comment the dead columns, and treat multi-currency as a costed future epic (FX rates, rounding per currency, per-currency VAT rules — not a column). If multi-currency is a near-term commercial requirement, it is its own phase, not a checkbox.
- **Acceptance:** either currency is validated ISO-4217 and formatters honor it, or the codebase states DKK-only in one place and enforces it.

**Risks:** data migration on live money. **Mitigation:** snapshot; verify aggregate sums before/after (`SUM(value)*100 == SUM(new_value)`); run on staging clone first.

---

# Phase 6 — Lifecycle & background jobs

**Objective:** documents change state without a human remembering to.

**Dependencies:** Phase 4 (generic transactional email), Phase 5 (units).

**Effort: 3 days.**

### FG-6.1 — Expiry sweeps *(API-22, DB-4, API-24)*

- **Purpose:** `quote.status='expired'` exists in the check constraint and **nothing ever assigns it** — `validUntil` is decorative, and a quote six months past validity can still be accepted and rolled into a deal. Contracts have the same disease: the renewal cron only notifies; nothing flips `active`→`expired`, so every `status='active'` filter — **including the cron's own** — counts expired contracts as active forever. Reports compound this by summing cancelled and draft contracts into "total value".
- **Technical approach:** enforce at both edges — a guard in the accept transition (a quote past `validUntil` cannot be accepted; offer "extend validity" instead) **and** a nightly sweep for reporting accuracy. Prefer derived status in queries over stored status where possible; stored status only where it must be visible to filters and indexes.
- **Backend:** sweep endpoint; accept-transition guard; status filters added to both report aggregations.
- **Frontend:** expired badge; "extend validity" action on an expired draft.
- **Acceptance:** a quote past validity cannot be accepted through the UI or API; contracts past expiry no longer appear in active counts; report totals exclude cancelled/draft.

### FG-6.2 — Renewal cron rewrite *(API-8, API-9, API-16, API-17, DB-7, DB-10)*

- **Purpose:** the contract-renewal cron is wrong in six ways: it loads **every** active dated un-notified contract across **all orgs** with no limit, filters the notice window in JavaScript (so contracts expiring years out are re-fetched forever), does one INSERT + one UPDATE per contract, notifies **only `contract.createdBy`** (whose FK is `SET NULL` — delete that user and their contracts silently stop notifying forever), is **not idempotent** (notification inserted before the stamp, no `IS NULL` guard, so any QStash retry duplicates), and its `GET` performs the same mutations as `POST`.
- **Technical approach:** claim-first idempotency (`UPDATE ... SET renewal_notified_at=now() WHERE id=$id AND renewal_notified_at IS NULL RETURNING id`, notify only on a claimed row — the same conditional-write idiom as FG-1.1); push the notice window into SQL; batch with `LIMIT`; add a partial index matching the predicate; fall back to org owners/admins when `createdBy` is null; make `GET` a dry-run only.
- **Backend:** `app/api/cron/contract-renewals/route.ts`, one migration for the partial index.
- **Acceptance:** running the cron twice produces one notification; a contract whose creator was deleted still notifies (org owner); the query plan uses the partial index; a 10k-contract org completes in a bounded number of statements.

### FG-6.3 — Register QStash schedules

- **Purpose:** both `contract-renewals` and the match-feed cron **have endpoints but no registered schedule** — they have never run in production.
- **Technical approach:** register with retry policy and dead-letter visibility; document in `MATCH_FEED_CRON.md` alongside the existing cron docs.
- **Acceptance:** schedules visible in QStash; a forced failure is retried and surfaced; the rotated secret (FG-0.2) is in use.

---

# Phase 7 — Scale, performance, security

**Objective:** survive real data volume and a degraded infrastructure.

**Dependencies:** Phase 1.

**Effort: 4 days.**

### FG-7.1 — Index completion *(DB-6, DB-11, DB-14c)*

- **Purpose:** every `deal_id`, both `product_id`s, `sales_order.quote_id`, and all `created_by` columns are unindexed. GDPR user erasure fires `SET NULL` against 6+ CRM tables via sequential scan; list pages sort `createdAt DESC` under an org filter with no `(org, created_at)` index; the `interaction_occurred_idx` is a bare global index serving no org-scoped query — pure write overhead in its current shape.
- **Technical approach:** one migration indexing all FK columns, adding `(org, created_at)` composites for list sorts and `(org, occurred_at)` for the timeline, and making `contact_phone_hash_idx` partial (`WHERE phone_hash IS NOT NULL`). Use `CONCURRENTLY` where the table is non-trivial.
- **Acceptance:** `EXPLAIN` on each list query shows an index scan without a sort step; no FK column lacks an index.

### FG-7.2 — Pagination everywhere *(API-13)*

- **Purpose:** products, segments, and `/api/reports/contract-expiry` return unbounded rows — the last loads every org contract into JavaScript to bucket them.
- **Technical approach:** `parsePagination` on products/segments; move contract-expiry bucketing into SQL aggregation.
- **Acceptance:** no endpoint can return an unbounded row set; the expiry report issues one aggregate query.

### FG-7.3 — Rate-limit posture *(API-10)*

- **Purpose:** all CRM rate limits run on Upstash, and `CLAUDE.md` documents Redis as **optional** — so a deployment without Redis has **zero** rate limiting on every CRM mutation and on records search, silently failing open.
- **Technical approach:** a decision, then enforcement. Recommend: fail **closed** in production for abuse-sensitive endpoints, with a startup check that refuses to boot without Redis when `NODE_ENV=production`; keep fail-open in development. Update `CLAUDE.md` — Redis stops being optional the moment it carries a security control.
- **Acceptance:** production boot fails loudly without Redis; a Redis outage degrades to rejection, not to unlimited; documentation matches behavior.

### FG-7.4 — Security cleanups *(API-14, API-15, API-20, LIB-10, LIB-16)*

- **Purpose:** four independent small holes. QStash signature verified **without the `url` claim** (a signature captured for `/api/cron/triggers` replays against `/api/cron/contract-renewals`); the `Bearer CRON_SECRET` comparison is non-constant-time; `savedCompany` search filters by `userId` only despite the table having `organizationId`, so a multi-org user sees cross-org saves; and **there is no API path to erase a contact's email or phone** — `""`→`undefined` makes "clear" indistinguishable from "unchanged", which is an own goal for a module built on PII encryption (GDPR erasure request cannot be fulfilled through the product).
- **Technical approach:** pass the request URL to `receiver.verify`; `timingSafeEqual`; add the org predicate; accept explicit `null` for clearable PII fields, mapping to a DB null **and** a null blind index. Also tighten `normalizePhone` (repeated `00` prefix stripping, extension digits appended to the number, >15-digit inputs) and validate phone shape at the schema rather than accepting 500 characters of free text.
- **Acceptance:** a cross-endpoint signature replay is rejected; a `PATCH` with `{"email": null}` clears both the ciphertext and the hash; a multi-org user sees only the active org's saved companies.

### FG-7.5 — Transactional integrity for multi-row writes *(API-7, API-18, API-23)*

- **Purpose:** prospect creation writes a workspace row, an optional saved-company row, and N contacts **without a transaction** — a mid-loop failure returns 500 with partial state committed and no indication of it. Its email dedup is check-then-insert despite a partial unique index existing, so a concurrent duplicate raises 23505 → 500 instead of skipping.
- **Technical approach:** wrap in `db.transaction`; treat unique violation as skip; verify `companyId` exists before the transaction so a bad UUID returns `404` rather than a generic FK 500; standardize referenced-entity misses on `404` (currently `400` in several routes).
- **Acceptance:** a forced failure on the third contact leaves **no** workspace row; a concurrent duplicate contact is skipped silently; error codes are consistent across routes.

---

# Phase 8 — Information architecture

**Objective:** navigation and page structure that reflect a CRM instead of the order features were built in.

**Dependencies:** Phase 2 (components exist to move around).

**Effort: 5 days.**

### FG-8.1 — Navigation restructure *(UX-9, UX-23)*

- **Purpose:** 20 top-level nav items. The CRM is split arbitrarily across "Tools" (pipeline, interactions, records, prospects, reports) and "Sales" (quotes, orders, products). The **"Prospects" item links to a creation form** — a verb sitting between nouns — and there is **no prospects list page at all**; created prospects are findable only via `/records` or `/pipeline`.
- **Technical approach:** consolidate into a single CRM section with a shallow hierarchy; creation becomes a button inside a list, never a nav destination. Modern comparables (Attio, Pipedrive, HubSpot) are **record-centric**: the company or deal is the hub and documents hang off it. Also unify the four page shells (max-w-2xl/3xl/4xl/full, cards-vs-rows at random) into one layout primitive.
- **Frontend:** `components/dashboard-layout.tsx`, new `/prospects` list, one page-shell component.
- **Acceptance:** ≤12 top-level items; every nav item is a noun; a prospect created yesterday is findable from the nav in one click.

### FG-8.2 — Documents on the record *(architectural gap)*

- **Purpose:** **the company page does not show its own quotes.** `CrmTab` has contacts, segments, contracts, interactions, notes, and activity — no quotes, no orders. A salesperson opening a customer cannot see what was quoted to them, which is the single most common CRM question.
- **Technical approach:** quotes/orders sections on `CrmTab` and on the deal drawer, reusing the list components from Phase 3. Consider making `/quotes` a secondary "all documents" view rather than the primary entry point.
- **Backend:** company- and deal-scoped list endpoints (or filter params on the existing ones).
- **Acceptance:** opening a company shows its quotes and orders with status and value; opening a deal shows its linked documents.

### FG-8.3 — CrmTab decomposition *(UX-11, UX-6, UX-25)*

- **Purpose:** 1,098 lines, six data sections, four inline form state machines, fifteen hooks, in one file — and it is styled with a **hardcoded light-only palette** (`bg-white`, `text-slate-900`, `ring-4 ring-white`) with zero `dark:` variants, so it renders broken in the app's dark theme. It also uses the material-symbols icon font while every sibling page uses lucide.
- **Technical approach:** split into `components/company/crm/{Contacts,Segments,Contracts,Quotes,Interactions,Notes,Activity}.tsx`; migrate to design tokens (`bg-card`, `text-foreground`, `border-border`); standardize on lucide. Duplicate `TYPE_ICON`/`typeLabel` maps (also present in the interactions page) move to the shared status vocabulary from FG-2.4.
- **Acceptance:** no file over ~300 lines; the company CRM tab renders correctly in dark mode; one icon system.

### FG-8.4 — Reports credibility *(UX-20, UX-21)*

- **Purpose:** the reports page has light-only chart chrome, an English series label ("count") in a Danish tooltip, and white 10px text stamped over user-chosen segment colors (fails WCAG on light swatches).
- **Technical approach:** tokenized chart theme; localized series names; compute contrast text color from swatch luminance.
- **Acceptance:** charts legible in both themes; no untranslated series label; segment chips meet 4.5:1.

---

# Phase 9 — Accessibility & polish ✅

**Objective:** the CRM is operable without a mouse and on a phone.

**Dependencies:** Phase 8.

**Effort: 2 days.**

> **Status note (as shipped).** Two of this phase's four findings were already
> closed by earlier work and needed no change: the quote line editor was made
> responsive in Phase 3 (`grid-cols-2 sm:grid-cols-4`, labelled inputs), and the
> products list's hover controls already carried a `focus-visible` reveal.
>
> **Deviation from the plan:** the roadmap called for shadcn Command/Combobox.
> The repo has neither `cmdk` nor Radix, so pulling one in for a single control
> was the wrong trade. Instead `components/crm/CompanyCombobox.tsx` implements
> the ARIA 1.2 combobox-with-listbox pattern directly and is shared by the quote
> builder and the prospect form — which also removed a duplicated
> debounce-plus-suggest block from both.
>
> The hover-reveal fix is `.row-action` in `globals.css`, gated on
> `@media (hover: hover) and (pointer: fine)` rather than a `sm:` breakpoint: a
> 1024px tablet is wide *and* touch, so a width gate leaves the control
> permanently invisible there.

### FG-9.1 — Controls and labels *(UX-15, UX-17, UX-24)*

- **Purpose:** delete and edit buttons are `opacity-0` until hover — keyboard users tab onto **invisible destructive controls**, and touch users cannot reach them at all until an accidental tap. Six product inputs are placeholder-only with no label; the interaction form has **two naked date inputs** that nothing distinguishes for a screen reader (occurred-at vs next-step).
- **Technical approach:** `focus-visible:opacity-100` plus always-visible on touch breakpoints; real `label`/`htmlFor` pairs everywhere; `aria-label` on the date inputs; edit actions scroll and focus their target form.
- **Acceptance:** every interactive control reachable and visible by keyboard; axe reports no missing-label violations on CRM pages.

### FG-9.2 — Comboboxes and mobile *(UX-16, UX-22)*

- **Purpose:** the company pickers in the prospect and quote flows are input + button list with no `role="combobox"`, no `aria-expanded`, and no arrow-key navigation. The quote line editor uses `grid-cols-4` at every breakpoint — four ~64px inputs on a 360px phone.
- **Technical approach:** shadcn Command/Combobox for both pickers; responsive line-editor grid (`grid-cols-2 sm:grid-cols-4`).
- **Acceptance:** company search is fully keyboard-operable; the builder is usable at 360px width.

---

# Phase 10 — Test harness & CI gates ✅

**Objective:** the next audit finds fewer things because CI found them first.

> **Status note (as shipped).** Three scope decisions were taken with the owner:
>
> 1. **`__tests__` stays gitignored.** CI therefore runs `tsc` and `lint` only.
>    The 274 unit tests exist on developer machines and must be run with
>    `pnpm test:run` before pushing. **FG-10.2's acceptance criterion — "a
>    rounding regression fails the build" — is consequently NOT met**; the tests
>    exist and pass, but nothing in CI can enforce them. Un-ignoring
>    `.gitignore:50` and uncommenting the test step in `.github/workflows/ci.yml`
>    is the entire remaining change.
> 2. **No database-backed integration harness** (FG-10.1 was scoped to the logic
>    layer). Cross-org isolation is covered by unit-testing the authorization
>    functions with the membership lookup stubbed — a missing member row *is*
>    the cross-org case — rather than by seeding a test Postgres.
> 3. **All 64 lint errors fixed**, so lint is a real gate. 52 were unescaped
>    quotes in Danish legal copy, escaped surgically from ESLint's own reported
>    positions (`&quot;`/`&apos;`, no visual change). The remaining 12 were
>    genuine React Compiler violations.
>
> Tests were mutation-checked rather than assumed: inverting the role-rank
> comparison, deleting the creator-or-admin check, flipping the quote-expiry
> boundary to `<=`, and reducing `roundOre` to `Math.round` each produced
> failures. A suite that cannot fail is not a gate.

**Why this position:** begins during Phase 1 and runs continuously — listed last because its full value lands at the end.

**Dependencies:** runs alongside everything.

**Effort: 4 days total, spread.**

### FG-10.1 — API contract & isolation tests

- **Purpose:** **no test proves org isolation, status transitions, or cron behavior** — the three areas where the audit found real defects. The only tested module is the totals engine.
- **Technical approach:** an integration harness with a test database and seeded two-org fixture. Priority order: (1) cross-org access returns 404/403 for every `[id]` route; (2) status-transition matrix including the illegal transitions; (3) concurrency tests for convert/accept/cron using parallel promises; (4) role-permission matrix.
- **Acceptance:** every route has an isolation test; a reintroduced double-convert fails CI.

### FG-10.2 — Money property tests

- **Purpose:** money math is the load-bearing correctness claim.
- **Technical approach:** extend `__tests__/unit/quote-totals.test.ts` with property-based cases (random qty/price/discount/VAT) asserting `total == subtotal + vat`, no negative totals, and client-preview ≡ server-persisted. Add the locale-parser table test from FG-1.2 and the half-øre boundary cases from FG-5.1. Note `__tests__` is gitignored repo-wide — **that must change** for CI to run them; resolve deliberately.
- **Acceptance:** money tests run in CI; a rounding regression fails the build.

### FG-10.3 — CI gates & cleanup *(LIB-18, LIB-21, LIB-22, LIB-17, DB-15, DB-13)*

- **Purpose:** lock in the gains and clear the small debt: `as unknown as` casts where typings exist, dead exports (`blindIndexEquals`, `normalizeForIndex`), `numbering.ts`'s misleading `nextNumber` name and its silent `?? 1` fallback that could mint a duplicate `Q-00001`, per-field PII key re-derivation (200 derivations for a 50-row list), `company_segment` with no provenance columns, and `interaction.occurredAt` accepting only a date while the column is `timestamptz`.
- **Technical approach:** CI runs `tsc`, `lint`, and tests on PR; fix the baseline `dashboard-layout.tsx` `Date.now()`-in-render error so lint can be a gate rather than a warning stream.
- **Acceptance:** CI is green and blocking; `pnpm lint` exits 0.

---

# Phase 11 — CRM parity backlog (not scheduled)

Costed later, listed so it is not rediscovered as "missing":

| Item | Why it matters | Rough size |
|---|---|---|
| Omnisearch (⌘K) across records, quotes, orders, CVR | The universal CRM entry point; `/records` is a page, not a reflex | M |
| CSV/Excel import + duplicate detection | Nobody adopts a CRM they must type into | L |
| Custom fields | Every real CRM deal dies without them | L |
| Invoicing (built-in, per the standing decision) | The obvious next document after an order | XL |
| Interaction attachments | Deferred in P3; unblocked by FG-4.1 | M |
| Email/calendar sync | Deferred by decision; revisit when follow-ups outgrow todos | XL |
| Quote templates & recurring quotes | Duplicate (FG-3.1) is the 80% version | M |
| Audit trail UI over `activity` | Data is logged; nothing surfaces it as a history view | M |

---

# Traceability matrix

Every audit finding, mapped to its phase. No finding is dropped.

| Phase | Findings |
|---|---|
| 0 | DB-14 (partial), migrations, secret rotation |
| 1 | API-1, API-2, API-3, API-4, API-5, API-6, API-19, API-25, DB-1, DB-2c, DB-8c, LIB-1, LIB-2, LIB-3, LIB-9 |
| 2 | UX-1, UX-2, UX-3, UX-4, UX-5, UX-10, UX-12, UX-13, UX-19, UX-26, UX-27, LIB-5, LIB-6, LIB-7, LIB-14, LIB-15, LIB-19, LIB-20, LIB-23a |
| 3 | UX-7, UX-8, UX-14, UX-18, API-11, API-12, API-21, LIB-11, LIB-12 |
| 4 | LIB-4, LIB-13, LIB-23b, storage enabler, email delivery, public accept |
| 5 | DB-3, DB-12, LIB-8 |
| 6 | API-8, API-9, API-16, API-17, API-22, API-24, DB-4, DB-7, DB-9, DB-10, QStash registration |
| 7 | API-7, API-10, API-13, API-14, API-15, API-18, API-20, API-23, DB-5, DB-6, DB-11, DB-14, LIB-10, LIB-16 |
| 8 | UX-6, UX-9, UX-11, UX-20, UX-21, UX-23, UX-25, company-documents gap |
| 9 | UX-15, UX-16, UX-17, UX-22, UX-24 |
| 10 | LIB-17, LIB-18, LIB-21, LIB-22, DB-13, DB-15, test coverage, CI gates |
| — | API-26 (no action: admin backfill auth verified sound) |

---

# Sequencing recommendations

**Solo engineer (~7.5 weeks):** 0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9 → 10 (tests written alongside from Phase 1).

**Two engineers (~4.5 weeks):** after Phases 0–1 land together, split — engineer A takes the backend track (5 → 6 → 7), engineer B takes the client track (2 → 3 → 8 → 9). Rejoin for Phase 4, which needs both. Phase 10 is shared and continuous.

**If only one week exists:** Phase 0 + Phase 1 only. That closes every data-corruption path and the authorization gap. Ship nothing else; the product is internally usable and no longer dangerous.

**What not to do:** skip Phase 2 to reach Phase 4 faster. Phase 4 adds a customer-facing surface; building it on the current inconsistent primitives means the highest-visibility page in the product inherits the lowest-quality patterns.

---

# Open decisions for the product owner

These are not engineering calls and block specific feature groups:

1. **Plan gating (FG-1.3 adjacent).** `PLAN.md` specified Professional+ for quotations; the shipped code gates everything behind `requireCrmOrg` = **Enterprise-only**. A pricing decision was made implicitly by code reuse. Confirm or correct.
2. **Multi-currency (FG-5.2).** DKK-only and honest, or a real currency epic?
3. **Public accept scope (FG-4.4).** Accept/reject only, or also comments, counter-offers, e-signature? Recommend accept/reject only for this round.
4. **Redis in production (FG-7.3).** Making rate limiting fail closed makes Redis a hard dependency. Confirm the infrastructure commitment.
5. **Test files gitignored (FG-10.2).** `__tests__` is currently ignored repo-wide. CI cannot run what is not committed. Confirm the change.
6. **Document numbering format (FG-6/DB-8).** `Q-00001` shipped; `Q-2026-0001` was planned. Adding year-reset later means renumbering — decide **now**, while the sequence table is nearly empty.
