-- drizzle/0034_rls_admin_system.sql

-- Enable RLS on org_audit_log (org-admin only)
ALTER TABLE "org_audit_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_audit_log_select_admin" ON "org_audit_log"
  FOR SELECT
  USING (is_org_admin(auth.uid(), "organization_id"));

CREATE POLICY "org_audit_log_insert_admin" ON "org_audit_log"
  FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), "organization_id"));

-- Enable RLS on email_log (user-owned)
ALTER TABLE "email_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_log_select_own" ON "email_log"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "email_log_insert_own" ON "email_log"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

-- Enable RLS on usage_record (org-member visible, user-owned detail)
ALTER TABLE "usage_record" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_record_select_own_or_org_admin" ON "usage_record"
  FOR SELECT
  USING (
    "user_id" = auth.uid()
    OR is_org_admin(auth.uid(), "organization_id")
  );

CREATE POLICY "usage_record_insert_own" ON "usage_record"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

-- Enable RLS on subscription (org-owned)
ALTER TABLE "subscription" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_select_org_admin" ON "subscription"
  FOR SELECT
  USING (is_org_admin(auth.uid(), "organization_id"));

CREATE POLICY "subscription_update_org_admin" ON "subscription"
  FOR UPDATE
  USING (is_org_admin(auth.uid(), "organization_id"));
