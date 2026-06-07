-- drizzle/0028_rls_user_data.sql

-- Enable RLS on user_brand table
ALTER TABLE "user_brand" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_brand_select_own" ON "user_brand"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "user_brand_update_own" ON "user_brand"
  FOR UPDATE
  USING ("user_id" = auth.uid());

CREATE POLICY "user_brand_delete_own" ON "user_brand"
  FOR DELETE
  USING ("user_id" = auth.uid());

-- Enable RLS on profile_enrichment table
ALTER TABLE "profile_enrichment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_enrichment_select_own" ON "profile_enrichment"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "profile_enrichment_insert_own" ON "profile_enrichment"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

-- Enable RLS on activity table
ALTER TABLE "activity" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_select_own" ON "activity"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "activity_insert_own" ON "activity"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

-- Enable RLS on todo table
ALTER TABLE "todo" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todo_select_own" ON "todo"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "todo_update_own" ON "todo"
  FOR UPDATE
  USING ("user_id" = auth.uid());

CREATE POLICY "todo_delete_own" ON "todo"
  FOR DELETE
  USING ("user_id" = auth.uid());
