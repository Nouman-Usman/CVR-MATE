-- drizzle/0024_rls_helpers.sql

-- Check if user is org member
CREATE OR REPLACE FUNCTION is_org_member(user_id text, org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM "member"
    WHERE "member"."user_id" = is_org_member.user_id
    AND "member"."organization_id" = is_org_member.org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_org_ids(user_id text)
RETURNS uuid[] AS $$
BEGIN
  RETURN COALESCE(
    ARRAY_AGG(DISTINCT "organization_id")
    FILTER (WHERE "organization_id" IS NOT NULL),
    ARRAY[]::uuid[]
  )
  FROM "member"
  WHERE "member"."user_id" = get_user_org_ids.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is org admin
CREATE OR REPLACE FUNCTION is_org_admin(user_id text, org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM "member"
    WHERE "member"."user_id" = is_org_admin.user_id
    AND "member"."organization_id" = is_org_admin.org_id
    AND "member"."role" >= 2  -- admin or owner
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
