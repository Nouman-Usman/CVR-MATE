-- drizzle/0033_rls_outreach_lead.sql

-- Enable RLS on outreach_message (org-owned)
ALTER TABLE "outreach_message" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outreach_message_select_org" ON "outreach_message"
  FOR SELECT
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "outreach_message_insert_org" ON "outreach_message"
  FOR INSERT
  WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "outreach_message_update_org" ON "outreach_message"
  FOR UPDATE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

-- Enable RLS on lead_trigger (org-owned)
ALTER TABLE "lead_trigger" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_trigger_select_org" ON "lead_trigger"
  FOR SELECT
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "lead_trigger_insert_org" ON "lead_trigger"
  FOR INSERT
  WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "lead_trigger_update_org" ON "lead_trigger"
  FOR UPDATE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "lead_trigger_delete_org" ON "lead_trigger"
  FOR DELETE
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

-- Enable RLS on trigger_result (org-owned)
ALTER TABLE "trigger_result" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trigger_result_select_org" ON "trigger_result"
  FOR SELECT
  USING ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));

CREATE POLICY "trigger_result_insert_org" ON "trigger_result"
  FOR INSERT
  WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "member" WHERE "user_id" = auth.uid()));
