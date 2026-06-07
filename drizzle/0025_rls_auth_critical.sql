-- drizzle/0025_rls_auth_critical.sql

-- Enable RLS on account table (contains access_token, refresh_token, password)
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_select_own" ON "account"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "account_update_own" ON "account"
  FOR UPDATE
  USING ("user_id" = auth.uid());

CREATE POLICY "account_delete_own" ON "account"
  FOR DELETE
  USING ("user_id" = auth.uid());

-- Enable RLS on session table (contains token)
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_select_own" ON "session"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "session_update_own" ON "session"
  FOR UPDATE
  USING ("user_id" = auth.uid());

CREATE POLICY "session_delete_own" ON "session"
  FOR DELETE
  USING ("user_id" = auth.uid());
