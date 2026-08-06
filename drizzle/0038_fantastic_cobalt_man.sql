DROP INDEX "interaction_occurred_idx";--> statement-breakpoint
DROP INDEX "contact_phone_hash_idx";--> statement-breakpoint
CREATE INDEX "company_workspace_company_idx" ON "company_workspace" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contract_deal_idx" ON "contract" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "contract_created_by_idx" ON "contract" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "deal_created_by_idx" ON "deal" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "deal_primary_contact_idx" ON "deal" USING btree ("primary_contact_id");--> statement-breakpoint
CREATE INDEX "interaction_org_occurred_idx" ON "interaction" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "interaction_deal_idx" ON "interaction" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "interaction_created_by_idx" ON "interaction" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "product_created_by_idx" ON "product" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "quote_deal_idx" ON "quote" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "quote_created_by_idx" ON "quote" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "quote_org_created_idx" ON "quote" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_line_product_idx" ON "quote_line" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_order_quote_idx" ON "sales_order" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "sales_order_deal_idx" ON "sales_order" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "sales_order_created_by_idx" ON "sales_order" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "sales_order_org_created_idx" ON "sales_order" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_order_line_product_idx" ON "sales_order_line" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "segment_created_by_idx" ON "segment" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "todo_assigned_idx" ON "todo" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "contact_phone_hash_idx" ON "contact" USING btree ("organization_id","phone_hash") WHERE "contact"."phone_hash" is not null;