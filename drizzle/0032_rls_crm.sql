-- drizzle/0032_rls_crm.sql

-- Enable RLS on crm_connection (org-owned, contains encrypted tokens)
ALTER TABLE "crm_connection" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_connection_select_org" ON "crm_connection"
  FOR SELECT
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "crm_connection_insert_org" ON "crm_connection"
  FOR INSERT
  WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "crm_connection_update_org" ON "crm_connection"
  FOR UPDATE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "crm_connection_delete_org" ON "crm_connection"
  FOR DELETE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

-- Enable RLS on crm_sync_log (org-owned)
ALTER TABLE "crm_sync_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_sync_log_select_org" ON "crm_sync_log"
  FOR SELECT
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "crm_sync_log_insert_org" ON "crm_sync_log"
  FOR INSERT
  WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

-- Enable RLS on crm_sync_mapping (org-owned)
ALTER TABLE "crm_sync_mapping" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_sync_mapping_select_org" ON "crm_sync_mapping"
  FOR SELECT
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "crm_sync_mapping_insert_org" ON "crm_sync_mapping"
  FOR INSERT
  WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "crm_sync_mapping_update_org" ON "crm_sync_mapping"
  FOR UPDATE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "crm_sync_mapping_delete_org" ON "crm_sync_mapping"
  FOR DELETE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));
