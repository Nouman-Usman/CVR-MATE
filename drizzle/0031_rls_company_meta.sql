-- drizzle/0031_rls_company_meta.sql

-- Enable RLS on company_briefing (org-visible)
ALTER TABLE "company_briefing" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_briefing_select_org" ON "company_briefing"
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM "company_workspace" cw
      WHERE cw."cvr" = "company_briefing"."cvr"
      AND cw."organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid())
    )
  );

-- Enable RLS on company_metrics (org-visible)
ALTER TABLE "company_metrics" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_metrics_select_org" ON "company_metrics"
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM "company_workspace" cw
      WHERE cw."cvr" = "company_metrics"."cvr"
      AND cw."organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid())
    )
  );

-- Enable RLS on company_note (org-owned)
ALTER TABLE "company_note" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_note_select_org" ON "company_note"
  FOR SELECT
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "company_note_insert_org" ON "company_note"
  FOR INSERT
  WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "company_note_update_org" ON "company_note"
  FOR UPDATE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "company_note_delete_org" ON "company_note"
  FOR DELETE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));
