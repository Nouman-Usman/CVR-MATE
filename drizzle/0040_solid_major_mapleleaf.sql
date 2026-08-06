CREATE TABLE "interaction_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"interaction_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"uploaded_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interaction_attachment_size_check" CHECK ("interaction_attachment"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "interaction_attachment" ADD CONSTRAINT "interaction_attachment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_attachment" ADD CONSTRAINT "interaction_attachment_interaction_id_interaction_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_attachment" ADD CONSTRAINT "interaction_attachment_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interaction_attachment_path_uq" ON "interaction_attachment" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "interaction_attachment_interaction_idx" ON "interaction_attachment" USING btree ("interaction_id");--> statement-breakpoint
CREATE INDEX "interaction_attachment_org_idx" ON "interaction_attachment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "interaction_attachment_uploaded_by_idx" ON "interaction_attachment" USING btree ("uploaded_by");