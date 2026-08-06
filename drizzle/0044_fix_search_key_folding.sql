-- Corrects the folding introduced in 0043.
--
-- 0043 expanded ø→oe, which made the three spellings users actually type
-- disagree with each other:
--   "Nørresundby"  → noerresundby
--   "NORRESUNDBY"  → norresundby     ← no match
--   "Noerresundby" → noerresundby
--
-- `extensions.unaccent` already maps æ→ae, ø→o, å→a. Collapsing the remaining
-- digraphs to their single letter AFTER unaccent makes every spelling converge:
--   Nørresundby / NORRESUNDBY / Noerresundby → norresundby
--   Ærø / AEROE / aeroe                      → aro
--   Ålborg / Aalborg                         → alborg
--
-- The trade-off is deliberate: "Boesen" also folds to "bosen", so a search for
-- "Bosen" matches it. For a substring search over company names, matching too
-- much is recoverable by typing more; matching too little is invisible.
--
-- The indexes are dropped and rebuilt around the change. Replacing a function
-- an index depends on does NOT rebuild that index — it would keep serving
-- entries computed by the old definition, which is worse than no index because
-- the results would be silently wrong.

DROP INDEX IF EXISTS public.company_name_search_idx;--> statement-breakpoint
DROP INDEX IF EXISTS public.contact_name_search_idx;--> statement-breakpoint
DROP INDEX IF EXISTS public.quote_number_search_idx;--> statement-breakpoint
DROP INDEX IF EXISTS public.sales_order_number_search_idx;--> statement-breakpoint
DROP INDEX IF EXISTS public.deal_title_search_idx;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.search_key(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $func$
  SELECT replace(
           replace(
             replace(public.f_unaccent(lower($1)), 'ae', 'a'),
             'oe', 'o'
           ),
           'aa', 'a'
         )
$func$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS company_name_search_idx
  ON public.company USING gin (public.search_key(name) extensions.gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS contact_name_search_idx
  ON public.contact USING gin (public.search_key(name) extensions.gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS quote_number_search_idx
  ON public.quote USING gin (public.search_key(number) extensions.gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS sales_order_number_search_idx
  ON public.sales_order USING gin (public.search_key(number) extensions.gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS deal_title_search_idx
  ON public.deal USING gin (public.search_key(title) extensions.gin_trgm_ops);
