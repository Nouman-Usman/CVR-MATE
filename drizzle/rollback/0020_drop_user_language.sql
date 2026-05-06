-- Rollback for: 0020_sturdy_madame_web.sql
-- Removes the language column added to the user table.
-- Run via: psql $DATABASE_URL -f drizzle/rollback/0020_drop_user_language.sql

ALTER TABLE "public"."user" DROP COLUMN IF EXISTS "language";
