-- drizzle/0036_rls_external.sql

-- Enable RLS on followed_person (user-owned)
ALTER TABLE "followed_person" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followed_person_select_own" ON "followed_person"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "followed_person_insert_own" ON "followed_person"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

CREATE POLICY "followed_person_delete_own" ON "followed_person"
  FOR DELETE
  USING ("user_id" = auth.uid());

-- Enable RLS on person_role_snapshot (public read, org-owned write)
ALTER TABLE "person_role_snapshot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "person_role_snapshot_select_all" ON "person_role_snapshot"
  FOR SELECT
  USING (true);

-- Enable RLS on person_role_event (public read)
ALTER TABLE "person_role_event" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "person_role_event_select_all" ON "person_role_event"
  FOR SELECT
  USING (true);

-- Enable RLS on person_company_index (public read)
ALTER TABLE "person_company_index" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "person_company_index_select_all" ON "person_company_index"
  FOR SELECT
  USING (true);

-- Enable RLS on enterprise_inquiry (public read, auth insert)
ALTER TABLE "enterprise_inquiry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enterprise_inquiry_select_own" ON "enterprise_inquiry"
  FOR SELECT
  USING ("email" = (SELECT "email" FROM "user" WHERE "id" = auth.uid()));

CREATE POLICY "enterprise_inquiry_insert_auth" ON "enterprise_inquiry"
  FOR INSERT
  WITH CHECK (true);

-- Enable RLS on change_feed_cursor (user-owned)
ALTER TABLE "change_feed_cursor" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "change_feed_cursor_select_own" ON "change_feed_cursor"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "change_feed_cursor_insert_own" ON "change_feed_cursor"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

CREATE POLICY "change_feed_cursor_update_own" ON "change_feed_cursor"
  FOR UPDATE
  USING ("user_id" = auth.uid());
