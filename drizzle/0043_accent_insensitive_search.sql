-- Accent- and case-insensitive record search.
--
-- `ILIKE` already ignored case, but not characters: searching "Norresundby"
-- missed "Nørresundby", and "Aeroe" missed "Ærø". Danish names are full of
-- æ/ø/å and users type whatever their keyboard makes easy, so an exact-byte
-- substring match is the wrong tool.
--
-- Also fixes a silent performance problem. `pg_trgm` was assumed present but was
-- never actually installed, so every name search was a sequential scan with a
-- leading-wildcard LIKE that no btree index can serve.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;--> statement-breakpoint

-- `extensions.unaccent(text)` is STABLE, not IMMUTABLE, because it reads a
-- dictionary that could in principle be changed. Postgres therefore refuses to
-- build an index on it. This wrapper asserts immutability, which is the
-- documented workaround and is true as long as the unaccent dictionary is not
-- modified — it never is here.
--
-- The two-argument form is pinned explicitly so the function does not depend on
-- search_path at call time; a search_path-dependent "immutable" function used in
-- an index is genuinely unsafe.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $func$
  SELECT extensions.unaccent('extensions.unaccent', $1)
$func$;--> statement-breakpoint

-- Fold Danish digraphs that unaccent does not handle: it maps å→a, but leaves
-- æ and ø alone, and Danes routinely type them as "ae" and "oe". Doing both
-- means "Norresundby", "Nørresundby" and "Noerresundby" all collapse to the
-- same search key.
CREATE OR REPLACE FUNCTION public.search_key(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $func$
  SELECT public.f_unaccent(
    replace(replace(replace(lower($1), 'æ', 'ae'), 'ø', 'oe'), 'å', 'aa')
  )
$func$;--> statement-breakpoint

-- GIN trigram indexes on the folded key. These are what make a leading-wildcard
-- `%term%` search index-backed instead of a full table scan.
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
