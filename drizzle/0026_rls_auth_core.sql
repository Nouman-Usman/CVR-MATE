-- drizzle/0026_rls_auth_core.sql

-- Enable RLS on user table
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_select_own" ON "user"
  FOR SELECT
  USING ("id" = auth.uid());

CREATE POLICY "user_update_own" ON "user"
  FOR UPDATE
  USING ("id" = auth.uid());

-- Org admins can view org members
CREATE POLICY "user_select_org_members" ON "user"
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM "member" m
      WHERE m."user_id" = auth.uid()
      AND m."organization_id" IN (
        SELECT "organization_id" FROM "member"
        WHERE "user_id" = "user"."id"
      )
      AND m."role" >= 2
    )
  );

-- Enable RLS on verification table
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification_select_own" ON "verification"
  FOR SELECT
  USING ("identifier" IN (
    SELECT "email" FROM "user" WHERE "id" = auth.uid()
  ));

CREATE POLICY "verification_insert" ON "verification"
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "verification_delete_own" ON "verification"
  FOR DELETE
  USING ("identifier" IN (
    SELECT "email" FROM "user" WHERE "id" = auth.uid()
  ));
