-- drizzle/0030_rls_company.sql

-- Enable RLS on saved_company table (user-owned)
ALTER TABLE "saved_company" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_company_select_own" ON "saved_company"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "saved_company_insert_own" ON "saved_company"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

CREATE POLICY "saved_company_delete_own" ON "saved_company"
  FOR DELETE
  USING ("user_id" = auth.uid());

-- Enable RLS on saved_search table (user-owned)
ALTER TABLE "saved_search" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_search_select_own" ON "saved_search"
  FOR SELECT
  USING ("user_id" = auth.uid());

CREATE POLICY "saved_search_update_own" ON "saved_search"
  FOR UPDATE
  USING ("user_id" = auth.uid());

CREATE POLICY "saved_search_delete_own" ON "saved_search"
  FOR DELETE
  USING ("user_id" = auth.uid());

-- Enable RLS on company table (read-only for search, org-specific queries)
ALTER TABLE "company" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_select_all" ON "company"
  FOR SELECT
  USING (true);

-- Enable RLS on company_workspace (org-owned)
ALTER TABLE "company_workspace" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_workspace_select_org" ON "company_workspace"
  FOR SELECT
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "company_workspace_insert_org" ON "company_workspace"
  FOR INSERT
  WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "company_workspace_update_org" ON "company_workspace"
  FOR UPDATE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));
