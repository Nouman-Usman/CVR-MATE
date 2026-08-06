-- Money unit unification: contract.value and deal.amount move from whole
-- kroner to INTEGER ØRE, matching quote/sales_order and the rest of the CRM.
--
-- Both statements are value conversions, not just type changes. Drizzle
-- generates only the ALTER; the multiplication is hand-written because the ORM
-- cannot know that the column's *meaning* changed.
--
-- NOT IDEMPOTENT — running either statement twice multiplies by 100 again. The
-- drizzle ledger is what prevents a re-run; do not replay this file by hand.

-- deal.amount: numeric (whole kroner) -> bigint (øre).
-- The multiplication happens while the column is still numeric, so any
-- fractional kroner left behind by the pre-fix rollup (which wrote an unrounded
-- total/100) converts exactly instead of being truncated by the cast.
ALTER TABLE "deal" ALTER COLUMN "amount" SET DATA TYPE bigint USING round("amount" * 100);--> statement-breakpoint

-- contract.value: already bigint, but held whole kroner.
UPDATE "contract" SET "value" = "value" * 100 WHERE "value" IS NOT NULL;
