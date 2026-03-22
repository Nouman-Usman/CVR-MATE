-- ============================================================================
-- CVR-MATE: Views, Stored Procedures & Advanced Indexes
-- Run this AFTER drizzle push/migrate creates the base tables
-- ============================================================================

-- ─── VIEWS ──────────────────────────────────────────────────────────────────

-- 1. Dashboard stats per user (trigger count, saved count, recent activity)
CREATE OR REPLACE VIEW v_user_dashboard_stats AS
SELECT
  u.id AS user_id,
  u.name AS user_name,
  u.email,
  COALESCE(t.trigger_count, 0) AS active_triggers,
  COALESCE(t.total_triggers, 0) AS total_triggers,
  COALESCE(ss.saved_search_count, 0) AS saved_searches,
  COALESCE(sc.saved_company_count, 0) AS saved_companies,
  COALESCE(n.unread_count, 0) AS unread_notifications,
  COALESCE(td.pending_todos, 0) AS pending_todos
FROM "user" u
LEFT JOIN (
  SELECT user_id,
    COUNT(*) FILTER (WHERE is_active = true) AS trigger_count,
    COUNT(*) AS total_triggers
  FROM lead_trigger GROUP BY user_id
) t ON t.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS saved_search_count
  FROM saved_search GROUP BY user_id
) ss ON ss.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS saved_company_count
  FROM saved_company GROUP BY user_id
) sc ON sc.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS unread_count
  FROM notification WHERE is_read = false GROUP BY user_id
) n ON n.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS pending_todos
  FROM todo WHERE is_completed = false GROUP BY user_id
) td ON td.user_id = u.id;


-- 2. Recent trigger results with trigger metadata
CREATE OR REPLACE VIEW v_trigger_results_detail AS
SELECT
  tr.id AS result_id,
  tr.trigger_id,
  tr.user_id,
  lt.name AS trigger_name,
  lt.frequency,
  lt.is_active,
  lt.filters AS trigger_filters,
  tr.companies,
  tr.match_count,
  tr.created_at AS run_at
FROM trigger_result tr
JOIN lead_trigger lt ON lt.id = tr.trigger_id
ORDER BY tr.created_at DESC;


-- 3. Saved companies with full company details
CREATE OR REPLACE VIEW v_saved_companies_detail AS
SELECT
  sc.id AS saved_id,
  sc.user_id,
  sc.created_at AS saved_at,
  c.id AS company_id,
  c.vat,
  c.name,
  c.city,
  c.zipcode,
  c.industry_code,
  c.industry_name,
  c.company_type,
  c.company_status,
  c.founded,
  c.employees,
  c.capital,
  c.phone,
  c.email,
  c.website,
  c.address
FROM saved_company sc
JOIN company c ON c.id = sc.company_id
ORDER BY sc.created_at DESC;


-- 4. Company search view with latest employment data
CREATE OR REPLACE VIEW v_company_search AS
SELECT
  c.id,
  c.vat,
  c.name,
  c.address,
  c.zipcode,
  c.city,
  c.municipality,
  c.industry_code,
  c.industry_name,
  c.company_type,
  c.company_status,
  c.founded,
  c.employees,
  c.capital,
  c.phone,
  c.email,
  c.website,
  c.last_fetched_at,
  c.created_at,
  -- Computed: is the data stale (older than 24h)?
  (c.last_fetched_at < NOW() - INTERVAL '24 hours') AS is_stale
FROM company c;


-- 5. User activity summary (for admin/analytics)
CREATE OR REPLACE VIEW v_user_activity AS
SELECT
  u.id AS user_id,
  u.name,
  u.email,
  u.created_at AS registered_at,
  (SELECT MAX(s.created_at) FROM session s WHERE s.user_id = u.id) AS last_login,
  (SELECT COUNT(*) FROM saved_company sc WHERE sc.user_id = u.id) AS companies_saved,
  (SELECT COUNT(*) FROM lead_trigger lt WHERE lt.user_id = u.id) AS triggers_created,
  (SELECT COUNT(*) FROM saved_search ss WHERE ss.user_id = u.id) AS searches_saved,
  (SELECT COUNT(*) FROM todo td WHERE td.user_id = u.id) AS todos_created
FROM "user" u
ORDER BY u.created_at DESC;


-- ─── STORED PROCEDURES / FUNCTIONS ──────────────────────────────────────────

-- 1. Upsert a company from CVR API response
--    Inserts if new, updates if vat exists. Returns the company id.
CREATE OR REPLACE FUNCTION upsert_company(
  p_vat TEXT,
  p_name TEXT,
  p_raw_data JSONB DEFAULT '{}',
  p_address TEXT DEFAULT NULL,
  p_zipcode TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_municipality TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_industry_code TEXT DEFAULT NULL,
  p_industry_name TEXT DEFAULT NULL,
  p_company_type TEXT DEFAULT NULL,
  p_company_status TEXT DEFAULT NULL,
  p_founded TEXT DEFAULT NULL,
  p_employees INTEGER DEFAULT NULL,
  p_capital NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO company (
    vat, name, raw_data,
    address, zipcode, city, municipality,
    phone, email, website,
    industry_code, industry_name, company_type, company_status,
    founded, employees, capital,
    last_fetched_at, updated_at
  ) VALUES (
    p_vat, p_name, p_raw_data,
    p_address, p_zipcode, p_city, p_municipality,
    p_phone, p_email, p_website,
    p_industry_code, p_industry_name, p_company_type, p_company_status,
    p_founded, p_employees, p_capital,
    NOW(), NOW()
  )
  ON CONFLICT (vat) DO UPDATE SET
    name = EXCLUDED.name,
    raw_data = EXCLUDED.raw_data,
    address = EXCLUDED.address,
    zipcode = EXCLUDED.zipcode,
    city = EXCLUDED.city,
    municipality = EXCLUDED.municipality,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    website = EXCLUDED.website,
    industry_code = EXCLUDED.industry_code,
    industry_name = EXCLUDED.industry_name,
    company_type = EXCLUDED.company_type,
    company_status = EXCLUDED.company_status,
    founded = EXCLUDED.founded,
    employees = EXCLUDED.employees,
    capital = EXCLUDED.capital,
    last_fetched_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- 2. Toggle save/unsave a company for a user
--    Returns TRUE if saved, FALSE if unsaved
CREATE OR REPLACE FUNCTION toggle_save_company(
  p_user_id TEXT,
  p_company_id UUID,
  p_cvr TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM saved_company
    WHERE user_id = p_user_id AND cvr = p_cvr
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM saved_company
    WHERE user_id = p_user_id AND cvr = p_cvr;
    RETURN FALSE;
  ELSE
    INSERT INTO saved_company (user_id, company_id, cvr)
    VALUES (p_user_id, p_company_id, p_cvr);
    RETURN TRUE;
  END IF;
END;
$$;


-- 3. Mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notification
  SET is_read = TRUE
  WHERE user_id = p_user_id AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- 4. Get user dashboard stats (optimized single query)
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id TEXT)
RETURNS TABLE(
  active_triggers BIGINT,
  saved_searches BIGINT,
  saved_companies BIGINT,
  unread_notifications BIGINT,
  pending_todos BIGINT,
  recent_trigger_runs BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM lead_trigger WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM saved_search WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM saved_company WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM notification WHERE user_id = p_user_id AND is_read = false),
    (SELECT COUNT(*) FROM todo WHERE user_id = p_user_id AND is_completed = false),
    (SELECT COUNT(*) FROM trigger_result WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '7 days');
END;
$$;


-- 5. Clean up old trigger results (keep last 100 per trigger)
CREATE OR REPLACE FUNCTION cleanup_old_trigger_results(p_keep_per_trigger INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY trigger_id ORDER BY created_at DESC) AS rn
    FROM trigger_result
  )
  DELETE FROM trigger_result
  WHERE id IN (SELECT id FROM ranked WHERE rn > p_keep_per_trigger);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


-- 6. Record a trigger execution and create notification
CREATE OR REPLACE FUNCTION record_trigger_run(
  p_trigger_id UUID,
  p_user_id TEXT,
  p_companies JSONB,
  p_match_count INTEGER
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_result_id UUID;
  v_trigger_name TEXT;
  v_channels JSONB;
BEGIN
  -- Insert trigger result
  INSERT INTO trigger_result (trigger_id, user_id, companies, match_count)
  VALUES (p_trigger_id, p_user_id, p_companies, p_match_count)
  RETURNING id INTO v_result_id;

  -- Update trigger last_run_at
  UPDATE lead_trigger
  SET last_run_at = NOW(), updated_at = NOW()
  WHERE id = p_trigger_id
  RETURNING name, notification_channels INTO v_trigger_name, v_channels;

  -- Create in-app notification if channel includes 'in_app'
  IF v_channels ? 'in_app' OR v_channels @> '"in_app"'::jsonb THEN
    INSERT INTO notification (user_id, type, title, message, link)
    VALUES (
      p_user_id,
      'trigger',
      v_trigger_name || ': ' || p_match_count || ' nye resultater',
      'Din trigger "' || v_trigger_name || '" fandt ' || p_match_count || ' nye virksomheder.',
      '/triggers'
    );
  END IF;

  RETURN v_result_id;
END;
$$;


-- ─── ADDITIONAL COMPOSITE INDEXES (for common query patterns) ───────────────

-- Fast lookup: user's triggers ordered by last run
CREATE INDEX IF NOT EXISTS lead_trigger_user_lastrun_idx
  ON lead_trigger (user_id, last_run_at DESC NULLS LAST);

-- Fast lookup: user's notifications ordered by created (for bell dropdown)
CREATE INDEX IF NOT EXISTS notification_user_created_idx
  ON notification (user_id, created_at DESC);

-- Fast lookup: user's todos by due date (for task list sorting)
CREATE INDEX IF NOT EXISTS todo_user_due_idx
  ON todo (user_id, due_date ASC NULLS LAST)
  WHERE is_completed = false;

-- Fast lookup: trigger results by trigger, newest first
CREATE INDEX IF NOT EXISTS trigger_result_trigger_created_idx
  ON trigger_result (trigger_id, created_at DESC);

-- Full-text search on company name (for autocomplete)
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS company_name_trgm_idx
--   ON company USING gin (name gin_trgm_ops);
