ALTER TABLE "contract" DROP CONSTRAINT "contract_company_id_company_id_fk";
--> statement-breakpoint
ALTER TABLE "quote" DROP CONSTRAINT "quote_company_id_company_id_fk";
--> statement-breakpoint
ALTER TABLE "sales_order" DROP CONSTRAINT "sales_order_company_id_company_id_fk";
--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "todo_interaction_live_uq" ON "todo" USING btree ("interaction_id") WHERE "todo"."interaction_id" is not null and "todo"."deleted_at" is null;