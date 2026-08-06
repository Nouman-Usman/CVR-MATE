ALTER TABLE "quote" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "quote" ADD COLUMN "public_token" text;--> statement-breakpoint
ALTER TABLE "quote" ADD COLUMN "responded_ip" text;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_public_token_idx" ON "quote" USING btree ("public_token") WHERE "quote"."public_token" is not null;