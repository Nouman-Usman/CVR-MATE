ALTER TABLE "contact" ADD COLUMN "phone_hash" text;--> statement-breakpoint
CREATE INDEX "contact_phone_hash_idx" ON "contact" USING btree ("organization_id","phone_hash");