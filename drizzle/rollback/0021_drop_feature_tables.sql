-- Rollback for: 0021_melted_frog_thor.sql
-- Drops the feature video tables added in that migration.
-- Run via: psql $DATABASE_URL -f drizzle/rollback/0021_drop_feature_tables.sql
--
-- WARNING: This is destructive — all feature_video, features, and user_video_view
-- rows will be permanently deleted. Take a backup first.

DROP TABLE IF EXISTS "public"."user_video_view";
DROP TABLE IF EXISTS "public"."feature_video";
DROP TABLE IF EXISTS "public"."features";
