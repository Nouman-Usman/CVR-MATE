-- drizzle/0027_rls_org.sql

-- Enable RLS on organization table
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_select_member_orgs" ON "organization"
  FOR SELECT
  USING (
    "id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid())
  );

CREATE POLICY "organization_update_admin_only" ON "organization"
  FOR UPDATE
  USING (is_org_admin(auth.uid(), "id"));

-- Enable RLS on member table
ALTER TABLE "member" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_select_own_org" ON "member"
  FOR SELECT
  USING (
    "user_id" = auth.uid()
    OR "organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid())
  );

CREATE POLICY "member_insert_admin_only" ON "member"
  FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), "organization_id"));

CREATE POLICY "member_update_admin_only" ON "member"
  FOR UPDATE
  USING (is_org_admin(auth.uid(), "organization_id"));

CREATE POLICY "member_delete_admin_only" ON "member"
  FOR DELETE
  USING (is_org_admin(auth.uid(), "organization_id"));

-- Enable RLS on invitation table
ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitation_select_own_created" ON "invitation"
  FOR SELECT
  USING (
    "inviter_id" = auth.uid()
    OR "email" = (SELECT "email" FROM "user" WHERE "id" = auth.uid())
    OR is_org_admin(auth.uid(), "organization_id")
  );

CREATE POLICY "invitation_insert_admin_only" ON "invitation"
  FOR INSERT
  WITH CHECK (
    "inviter_id" = auth.uid()
    AND is_org_admin(auth.uid(), "organization_id")
  );

CREATE POLICY "invitation_delete_admin_or_self" ON "invitation"
  FOR DELETE
  USING (
    "inviter_id" = auth.uid()
    OR is_org_admin(auth.uid(), "organization_id")
  );
