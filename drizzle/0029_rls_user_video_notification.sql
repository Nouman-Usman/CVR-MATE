-- drizzle/0029_rls_user_video_notification.sql

-- Enable RLS on user_video_view table
ALTER TABLE "user_video_view" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_video_view_select_own" ON "user_video_view"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "user_video_view_insert_own" ON "user_video_view"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

CREATE POLICY "user_video_view_update_own" ON "user_video_view"
  FOR UPDATE
  USING ("user_id" = auth.uid());

-- Enable RLS on notification table
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_select_own" ON "notification"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "notification_update_own" ON "notification"
  FOR UPDATE
  USING ("user_id" = auth.uid());

CREATE POLICY "notification_delete_own" ON "notification"
  FOR DELETE
  USING ("user_id" = auth.uid());
