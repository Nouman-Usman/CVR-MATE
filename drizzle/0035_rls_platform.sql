-- drizzle/0035_rls_platform.sql

-- Enable RLS on features table (public read)
ALTER TABLE "features" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "features_select_all" ON "features"
  FOR SELECT
  USING (true);

-- Enable RLS on feature_video table (public read, backend insert/update)
ALTER TABLE "feature_video" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_video_select_all" ON "feature_video"
  FOR SELECT
  USING ("status" = 'published' OR is_org_admin(auth.uid(), NULL));
