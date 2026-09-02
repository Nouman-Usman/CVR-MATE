ALTER TABLE "company_note" DROP CONSTRAINT "company_note_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "saved_company" DROP CONSTRAINT "saved_company_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "saved_search" DROP CONSTRAINT "saved_search_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "todo" DROP CONSTRAINT "todo_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "company_note" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_company" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_search" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "todo" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "company_note" ADD CONSTRAINT "company_note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_company" ADD CONSTRAINT "saved_company_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;