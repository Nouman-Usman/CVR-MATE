CREATE TABLE "annual_report_digest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"last_digest_on" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annual_report_digest" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_brand" ADD COLUMN "annual_report_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "annual_report_digest" ADD CONSTRAINT "annual_report_digest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "annual_report_digest_user_uq" ON "annual_report_digest" USING btree ("user_id");