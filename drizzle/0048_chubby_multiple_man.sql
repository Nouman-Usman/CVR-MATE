CREATE UNIQUE INDEX "member_org_user_uq" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_single_owner_uq" ON "member" USING btree ("organization_id") WHERE "member"."role" = 'owner';--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_role_check" CHECK ("member"."role" in ('owner','admin','member'));