DROP INDEX "order_invoice_external_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "order_invoice_external_uq" ON "order_invoice" USING btree ("connection_id","external_id");